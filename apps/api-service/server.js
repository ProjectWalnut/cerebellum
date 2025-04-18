const Koa = require("koa");
const Router = require("@koa/router");
const bodyParser = require("koa-bodyparser");
const fs = require("fs");
const path = require("path");
const appContext = require("../../core/app-context/appContext");

const app = new Koa();
const router = new Router();
const CONTROLLERS_DIR = path.join(__dirname, "controllers");

// Register middleware and routes
app.use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

async function internal_api_service() {
  try {
    // Initialize appContext and all registered services (e.g., RabbitMQ, HuggingFace, Qdrant)
    await appContext.init();

    // Dynamically load route files from the controllers folder
    fs.readdirSync(CONTROLLERS_DIR).forEach((file) => {
      const route = require(path.join(CONTROLLERS_DIR, file));
      router.use(route.routes()).use(route.allowedMethods());
    });

    const port = process.env.PORT || 3000;
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Failed to initialize appContext:", err);
    process.exit(1);
  }
}

// Start the server
internal_api_service();
