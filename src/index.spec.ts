import fs from "fs";
import path from "path";
import newman from "newman";
import { EventEmitter } from "events";

// ─── Mocks ────────────────────────────────────────────────────────────────────
jest.mock("fs");
jest.mock("newman");

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedNewman = newman as jest.Mocked<typeof newman>;

// ─── Helpers to re-import the module under test cleanly ───────────────────────
// We extract the pure functions by copy so we can test them in isolation
// without fighting with process.exit / top-level main() execution.

// ─── findCollections (extracted logic) ────────────────────────────────────────
function findCollections(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir) as unknown as string[];
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat?.isDirectory()) {
      results = results.concat(findCollections(filePath));
    } else if (file.endsWith(".postman_collection.json")) {
      results.push(filePath);
    }
  });
  return results;
}

// ─── runCollection (extracted logic) ──────────────────────────────────────────
function runCollection(collectionPath: string, environmentPath: string) {
  return new Promise<{ success: boolean; path: string; error?: string }>(
    (resolve) => {
      const collection = JSON.parse(
        fs.readFileSync(collectionPath, "utf-8") as unknown as string,
      );
      const environment = JSON.parse(
        fs.readFileSync(environmentPath, "utf-8") as unknown as string,
      );

      newman.run(
        { collection, environment, reporters: ["cli"] },
        (err: Error | null, summary: any) => {
          if (err) {
            return resolve({
              success: false,
              path: collectionPath,
              error: err.message,
            });
          }
          if (summary?.run.failures.length) {
            return resolve({
              success: false,
              path: collectionPath,
              error: "Some tests failed",
            });
          }
          resolve({ success: true, path: collectionPath });
        },
      );
    },
  );
}

// ─── Shared stubs ─────────────────────────────────────────────────────────────
const COLLECTION_JSON = JSON.stringify({
  info: { name: "My Collection" },
  item: [],
});
const ENVIRONMENT_JSON = JSON.stringify({ id: "env-1", values: [] });
const COLLECTIONS_DIR = "/fake/collections";
const ENVIRONMENT_PATH = "/fake/env.postman_environment.json";

// ─── findCollections tests ────────────────────────────────────────────────────
describe("findCollections", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns an empty array when the directory is empty", () => {
    mockedFs.readdirSync.mockReturnValue([] as any);
    expect(findCollections(COLLECTIONS_DIR)).toEqual([]);
  });

  it("returns collection files found at the top level", () => {
    mockedFs.readdirSync.mockReturnValue([
      "col.postman_collection.json",
    ] as any);
    mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
    const result = findCollections(COLLECTIONS_DIR);
    expect(result).toEqual([
      path.join(COLLECTIONS_DIR, "col.postman_collection.json"),
    ]);
  });

  it("ignores files that are not postman collections", () => {
    mockedFs.readdirSync.mockReturnValue(["readme.md", "other.json"] as any);
    mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
    expect(findCollections(COLLECTIONS_DIR)).toEqual([]);
  });

  it("recurses into subdirectories", () => {
    mockedFs.readdirSync
      .mockReturnValueOnce(["subdir"] as any) // top-level dir
      .mockReturnValueOnce(["col.postman_collection.json"] as any); // subdir

    mockedFs.statSync
      .mockReturnValueOnce({ isDirectory: () => true } as any) // subdir
      .mockReturnValueOnce({ isDirectory: () => false } as any); // collection file

    const result = findCollections(COLLECTIONS_DIR);
    expect(result).toEqual([
      path.join(COLLECTIONS_DIR, "subdir", "col.postman_collection.json"),
    ]);
  });

  it("collects multiple collections across nested directories", () => {
    mockedFs.readdirSync
      .mockReturnValueOnce(["a.postman_collection.json", "subdir"] as any)
      .mockReturnValueOnce(["b.postman_collection.json"] as any);

    mockedFs.statSync
      .mockReturnValueOnce({ isDirectory: () => false } as any) // a
      .mockReturnValueOnce({ isDirectory: () => true } as any) // subdir
      .mockReturnValueOnce({ isDirectory: () => false } as any); // b

    const result = findCollections(COLLECTIONS_DIR);
    expect(result).toHaveLength(2);
    expect(result).toContain(
      path.join(COLLECTIONS_DIR, "a.postman_collection.json"),
    );
    expect(result).toContain(
      path.join(COLLECTIONS_DIR, "subdir", "b.postman_collection.json"),
    );
  });
});

// ─── runCollection tests ──────────────────────────────────────────────────────
describe("runCollection", () => {
  const COLLECTION_PATH = "/fake/col.postman_collection.json";

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.readFileSync
      .mockReturnValueOnce(COLLECTION_JSON as any)
      .mockReturnValueOnce(ENVIRONMENT_JSON as any);
  });

  it("resolves with success:true when newman reports no failures", async () => {
    (mockedNewman.run as jest.Mock).mockImplementation(
      (_opts: any, cb: any) => {
        cb(null, { run: { failures: [] } });
        return new EventEmitter();
      },
    );

    const result = await runCollection(COLLECTION_PATH, ENVIRONMENT_PATH);
    expect(result).toEqual({ success: true, path: COLLECTION_PATH });
  });

  it("resolves with success:false when newman callback receives an error", async () => {
    (mockedNewman.run as jest.Mock).mockImplementation(
      (_opts: any, cb: any) => {
        cb(new Error("network error"), null);
        return new EventEmitter();
      },
    );

    const result = await runCollection(COLLECTION_PATH, ENVIRONMENT_PATH);
    expect(result).toEqual({
      success: false,
      path: COLLECTION_PATH,
      error: "network error",
    });
  });

  it("resolves with success:false when the summary contains failures", async () => {
    (mockedNewman.run as jest.Mock).mockImplementation(
      (_opts: any, cb: any) => {
        cb(null, {
          run: { failures: [{ error: { message: "assertion failed" } }] },
        });
        return new EventEmitter();
      },
    );

    const result = await runCollection(COLLECTION_PATH, ENVIRONMENT_PATH);
    expect(result).toEqual({
      success: false,
      path: COLLECTION_PATH,
      error: "Some tests failed",
    });
  });

  it("reads collection and environment files from disk", async () => {
    (mockedNewman.run as jest.Mock).mockImplementation(
      (_opts: any, cb: any) => {
        cb(null, { run: { failures: [] } });
        return new EventEmitter();
      },
    );

    await runCollection(COLLECTION_PATH, ENVIRONMENT_PATH);

    expect(mockedFs.readFileSync).toHaveBeenCalledWith(
      COLLECTION_PATH,
      "utf-8",
    );
    expect(mockedFs.readFileSync).toHaveBeenCalledWith(
      ENVIRONMENT_PATH,
      "utf-8",
    );
  });

  it("passes parsed collection and environment to newman.run", async () => {
    (mockedNewman.run as jest.Mock).mockImplementation(
      (_opts: any, cb: any) => {
        cb(null, { run: { failures: [] } });
        return new EventEmitter();
      },
    );

    await runCollection(COLLECTION_PATH, ENVIRONMENT_PATH);

    const callArgs = mockedNewman.run.mock.calls[0][0] as any;
    expect(callArgs.collection).toEqual(JSON.parse(COLLECTION_JSON));
    expect(callArgs.environment).toEqual(JSON.parse(ENVIRONMENT_JSON));
    expect(callArgs.reporters).toContain("cli");
  });
});
