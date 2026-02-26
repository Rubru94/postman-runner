# Postman Runner

Portable CLI tool to execute multiple Postman collections using Newman, without requiring Node.js or npm installed on the target machine.

This tool is designed to be copied into any backend project and executed as a standalone binary.

---

## 🚀 Features

- Runs multiple `.postman_collection.json` files recursively
- Accepts `collections directory` as argument
- Accepts `environment file` as argument
- Fails with non-zero exit code if any test fails
- No need to install Node.js on the target project
- Fully portable binary

---

## 📦 Project Setup (Development)

### 1. Install dependencies

```bash
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Generate portable binary

```bash
npm run package
```

This will generate platform-specific binaries inside the `/pkg` directory:

- `pkg/postman-runner-macos`
- `pkg/postman-runner-linux`
- `pkg/postman-runner-win.exe`

---

## 🧩 Usage

The binary requires two arguments:

```
postman-runner <collectionsPath> <environmentPath>
```

### Example (inside a Spring project)

```
./postman-runner driving/api-rest/postman driving/api-rest/postman/local.postman_environment.json
```

### What it does

- Recursively scans `<collectionsPath>`
- Finds all `.postman_collection.json` files
- Executes them sequentially
- Stops immediately if a collection fails
- Returns exit code `1` on failure
- Returns exit code `0` on success

---

## 📁 Expected Project Structure Example

```
your-spring-project/
 ├── driving/api-rest/postman/
 │    ├── component/
 │    │    └── component.postman_collection.json
 │    ├── validation/
 │    │    └── validation.postman_collection.json
 │    └── local.postman_environment.json
 ├── postman-runner
```

---

## 🔐 Crypto Compatibility

If Postman tests rely on `crypto`, the runner injects Node’s native `crypto` module into the Newman sandbox automatically, so collections do not need to be modified.

---

## 🛠 Development Scripts

```
npm run build      # Compile TypeScript
```

```
npm run package    # Build portable binary (output in /pkg)
```

---

## 📌 Notes

- Collections must be exported in Postman v2.1 format.
- Environment file must be valid JSON.
- Paths can be relative or absolute.
- Binary must match the target OS architecture.

---

## 🏁 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All collections executed successfully |
| 1 | At least one collection failed |
| 1 | Invalid arguments or missing files |

---