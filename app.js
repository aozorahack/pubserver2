const fs = require('fs');
const crypto = require('crypto');
const serve = require('koa-static');
const morgan = require('koa-morgan');
const koabody = require('koa-body');
const compress = require('koa-compress');
const Router = require('koa-router');
const Koa = require('koa');

const mongodb = require('mongodb');

const access_log= fs.createWriteStream('./access.log', { flags: 'a' });

const mongodb_credential = process.env.AOZORA_MONGODB_CREDENTIAL || '';
const mongodb_host = process.env.AOZORA_MONGODB_HOST || 'localhost';
const mongodb_port = process.env.AOZORA_MONGODB_PORT || '27017';
const mongo_url = `mongodb://${mongodb_credential}${mongodb_host}:${mongodb_port}/aozora`;

const DEFAULT_LIMIT = 100;

const VERSION = 'v0.1';
const API_ROOT = `/api/${VERSION}`;

//
// utilities
//

const re_or_str = (src) => {
  if (src[0] === '/' && src.slice(-1) === '/') {
    return {'$in': [new RegExp(src.slice(1, -1))]};
  } else {
    return src;
  }
};

const return_json = (ctx, doc) => {
  let body = JSON.stringify(doc);
  ctx.response.etag = crypto.createHash('sha1').update(body).digest('hex');
  ctx.status = 200;

  if (ctx.fresh) {
    ctx.status = 304;
    ctx.body = null;
  } else {
    ctx.type = 'application/json; charset=utf-8';
    ctx.body = body;
  }
};

//
// make router and app
//
const connect_db = async () => {
  let MongoClient = mongodb.MongoClient;
  let db = await MongoClient.connect(mongo_url);
  let my = {};
  my.db = db;
  my.books = db.collection('books');
  my.authors = db.collection('authors');
  my.persons = db.collection('persons');
  my.workers = db.collection('workers');

  //redis_url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  //  app.my.rc = redis.createClient(redis_url, {return_buffers: true})

  return my;
};

const make_router = (app) => {
  const router = new Router();
  
  //
  // books
  //
  router.get(API_ROOT + '/books', async (ctx) => {
    let req = ctx.request;
    let query = {};

    if (req.query.title) {
      query['title'] = re_or_str(req.query.title);
    }
    if (req.query.author) {
      let person = await app.my.persons.findOne (
        {$where: `var author = "${req.query.author}"; this.last_name + this.first_name == author || this.last_name == author || this.first_name == author`});
      if (!person) {
        ctx.status=404;
        return;
      }
      query['authors.person_id'] = person.person_id;
    }
    if (req.query.after) {
      query['release_date'] = {'$gte': new Date(req.query.after)};
    }

    let options = {
      sort: {
        release_date: -1
      },
      fields: {
        _id: 0
      }
    };

    if (req.query.fields) {
      req.query.fields.forEach((a) => {
        options.fields[a] = 1;
      });
    }
    if (req.query.limit) {
      options.limit = parseInt(req.query.limit);
    } else {
      options.limit = DEFAULT_LIMIT;
    }
    if (req.query.skip) {
      options.skip = parseInt(req.query.skip);
    }

    let docs = await app.my.books.find(query, options).toArray();
    if(docs) {
      return_json(ctx, docs);
    } else {
      ctx.body = '';
      ctx.status = 404;
    }
  });

  router.get(API_ROOT + '/books/:book_id', async (ctx) => {
    let book_id = parseInt(ctx.params.book_id);
    console.log(`/books/${book_id}`);
    let doc = await app.my.books.findOne({book_id: book_id});
    if (doc) {
      return_json(ctx, doc);
    } else {
      ctx.body = '';
      ctx.status = 404;
    }
  });

  return router;
};

const make_app = async () => {
  const app = new Koa();
  //
  // middleware
  //
  app.use(compress());
  app.use(serve('./public'));
  app.use(morgan('combined', { stream: access_log}));
  app.use(koabody());

  app.my = await connect_db();

  const router = make_router(app);
  app
    .use(router.routes())
    .use(router.allowedMethods());

  return app;
};

exports.make_app = make_app;
