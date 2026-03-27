import newman from "newman";
import fs from "fs";
import path from "path";

/**
 * Recursively finds all Postman collection files in a directory.
 *
 * @param {string} dir - Directory path to search for collections.
 * @returns {string[]} Array of collection file paths.
 */
function findCollections(dir: string): string[] {
  let results: string[] = [];

  const list = fs.readdirSync(dir);

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

/**
 * Runs a single Postman collection with a given environment.
 *
 * @param {string} collectionPath - Path to the Postman collection JSON file.
 * @param {string} environmentPath - Path to the Postman environment JSON file.
 * @returns {Promise<{ success: boolean; path: string; error?: string }>} Result of the collection run.
 */
async function runCollection(
  collectionPath: string,
  environmentPath: string,
): Promise<{ success: boolean; path: string; error?: string }> {
  return new Promise((resolve) => {
    const collection = JSON.parse(fs.readFileSync(collectionPath, "utf-8"));
    const environment = JSON.parse(fs.readFileSync(environmentPath, "utf-8"));

    console.log("\n=====================================");
    console.log(`Running: ${collectionPath}`);
    console.log("=====================================\n");

    newman.run(
      {
        collection,
        environment,
        reporters: ["cli"],
      },
      (err, summary) => {
        if (err) {
          console.error(`\n❌ Error running ${collectionPath}:`, err.message);
          return resolve({
            success: false,
            path: collectionPath,
            error: err.message,
          });
        }

        if (summary?.run.failures.length) {
          console.error(`\n❌ Failures in ${collectionPath}`);
          return resolve({
            success: false,
            path: collectionPath,
            error: "Some tests failed",
          });
        }

        console.log(`\n✅ ${collectionPath} passed`);
        resolve({ success: true, path: collectionPath });
      },
    );
  });
}

/**
 * Main entry point of the Postman CLI runner.
 *
 * Reads command-line arguments, finds collections, runs them, and outputs a summary.
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage:");
    console.error("postman-runner <collectionsPath> <environmentPath>");
    process.exit(1);
  }

  const collectionsDir = path.resolve(args[0]);
  const environmentPath = path.resolve(args[1]);

  if (!fs.existsSync(collectionsDir)) {
    console.error("Collections directory not found:", collectionsDir);
    process.exit(1);
  }

  if (!fs.existsSync(environmentPath)) {
    console.error("Environment file not found:", environmentPath);
    process.exit(1);
  }

  const collections = findCollections(collectionsDir);

  if (!collections.length) {
    console.log("No collections found.");
    process.exit(0);
  }

  const results: { path: string; success: boolean; error?: string }[] = [];

  for (const collection of collections) {
    const result = await runCollection(collection, environmentPath);
    results.push(result);
  }

  console.log("\n=====================================");
  const total = results?.length ?? 0;
  const passed = results?.filter((r) => r.success).length ?? 0;
  const failed = results?.filter((r) => !r.success).length ?? 0;

  console.log(`Total collections: ${total} (✅ ${passed}; ❌ ${failed})`);
  console.log("\nExecution summary:");

  let anyFailed = false;
  results.forEach((r) => {
    if (r.success) {
      console.log(`✅ ${r.path}`);
    } else {
      console.log(`❌ ${r.path} → ${r.error}`);
      anyFailed = true;
    }
  });
  console.log("\n=====================================");

  if (anyFailed) {
    console.error("❌ Some collections failed.");
    process.exit(1);
  } else {
    console.log("✅ All collections executed successfully.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Execution failed:", err.message);
  process.exit(1);
});
