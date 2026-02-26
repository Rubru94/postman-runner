import newman from "newman";
import fs from "fs";
import path from "path";

function findCollections(dir: string): string[] {
  let results: string[] = [];

  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(findCollections(filePath));
    } else if (file.endsWith(".postman_collection.json")) {
      results.push(filePath);
    }
  });

  return results;
}

async function runCollection(collectionPath: string, environmentPath: string) {
  return new Promise<void>((resolve, reject) => {
    const collection = JSON.parse(fs.readFileSync(collectionPath, "utf-8"));
    const environment = JSON.parse(fs.readFileSync(environmentPath, "utf-8"));

    console.log("=====================================");
    console.log(`Running: ${collectionPath}`);
    console.log("=====================================");

    newman.run(
      {
        collection,
        environment,
        reporters: ["cli"],
      },
      (err, summary) => {
        if (err) return reject(err);

        if (summary?.run.failures.length) {
          return reject(new Error(`Failures in ${collectionPath}`));
        }

        resolve();
      },
    );
  });
}

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

  for (const collection of collections) {
    await runCollection(collection, environmentPath);
  }

  console.log("✅ All collections executed successfully");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Execution failed:", err.message);
  process.exit(1);
});
