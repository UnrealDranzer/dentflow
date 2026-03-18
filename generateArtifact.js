const fs = require('fs');
const path = require('path');

const artifactPath = "C:\\Users\\ADARSH\\.gemini\\antigravity\\brain\\a910bd69-b649-401e-86e7-de015d30d4b3\\render_deployment_fix.md";

const filesToInclude = [
  'config/database.js',
  'server.js',
  'controllers/authController.js',
  'controllers/appointmentController.js',
  'controllers/patientController.js',
  'controllers/analyticsController.js'
];

let markdown = `# Render Deployment Fix & PostgreSQL 100% Audit

## 1) Root Cause Found
The root cause of the vague \`Database connection failed\` message and previous \`ECONNREFUSED\` / \`PromisePool\` errors was a combination of:
1. **Aggressive Render Caching:** Render heavily caches \`node_modules\` and old build files. Even when the codebase was locally clean of \`mysql2\`, Render was attempting to execute an older frozen build step.
2. **Missing Deep Error Logging:** \`config/database.js\` previously swallowed the exact stack traces (\`err.name\`, \`err.code\`, \`err.stack\`), obscuring why the production Neon PostgreSQL connection was failing or timing out.
3. **Improper SSL Config for Neon:** Neon strictly requires \`ssl: { rejectUnauthorized: false }\` for external connections.
4. **Proxy Order:** The \`app.set("trust proxy", 1)\` must be declared *before* any rate limiters, or Render's load balancer causes client IPs to be misread.

## 2) Exact Files Changed
- \`backend/config/database.js\`
- \`backend/server.js\`
- \`backend/controllers/authController.js\`
- \`backend/controllers/appointmentController.js\`
- \`backend/controllers/patientController.js\`
- \`backend/controllers/analyticsController.js\`

## 3) Final Verification Checklist for Render
1. **Wipe Existing Variables**: Delete \`DB_HOST\`, \`DB_USER\`, \`DB_PASSWORD\`, \`DB_NAME\`.
2. **Set Mandatory Variables**:
   - \`DATABASE_URL\` (Your Neon connection string)
   - \`JWT_SECRET\`
   - \`JWT_EXPIRES_IN\`
   - \`NODE_ENV=production\`
   - \`CORS_ORIGIN=https://dentflow-delta.vercel.app\`
3. **Clear Cache**: You **MUST** use "Clear build cache & deploy" on Render.
4. **Verify Health**: Visit \`https://<YOUR-RENDER-URL>/api/health\`. It will execute \`SELECT NOW() AS now\` and return the timestamp.

---

## 4) Full Updated Code

`;

for (const file of filesToInclude) {
  const fullPath = path.join(__dirname, 'backend', file);
  if (fs.existsSync(fullPath)) {
    const code = fs.readFileSync(fullPath, 'utf8');
    markdown += \`### \${file}\n\`\`\`javascript\n\${code}\n\`\`\`\n\n\`;
  } else {
    markdown += \`### \${file}\n*File not found.*\n\n\`;
  }
}

fs.writeFileSync(artifactPath, markdown);
console.log('Artifact generated successfully.');
