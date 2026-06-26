export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname.toLowerCase();

  // 1. Files that should throw a 401 Unauthorized
  const filesToBlock401 = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'vite.config.js',
    'vite.config.ts',
    'tsconfig.json',
    'webpack.config.js',
    'readme.md'
  ];

  // Check for exact file matches in the blocklist
  const fileName = pathname.split('/').pop();
  if (filesToBlock401.includes(fileName)) {
    return new Response("Unauthorized: System file access denied.", {
      status: 401,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 2. Directories and extensions that should throw a 404 Not Found
  if (
    pathname.includes('.env') ||
    pathname.includes('.git') ||
    pathname.includes('.vscode') ||
    pathname.includes('.idea') ||
    pathname.includes('node_modules')
  ) {
    return new Response("404 Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 3. Let everything else pass through safely (Assets, index.html, etc.)
  return next();
}
