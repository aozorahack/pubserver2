const make_app = require('./app.js').make_app;

const run_app = async () => {
  const app = await make_app();
  app.listen(process.env.PORT || 5000);
};

run_app();
