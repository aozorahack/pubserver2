import fs from 'fs';
import crypto from 'crypto';
import serve from 'koa-static';
import morgan from 'koa-morgan';
import koabody from 'koa-body';
import compress from 'koa-compress';
import Router from 'koa-router';
import Koa from 'koa';

import mongodb from 'mongodb';

const accessLogStream = fs.createWriteStream('./access.log',
                                             { flags: 'a' });

const mongodb_credential = process.env.AOZORA_MONGODB_CREDENTIAL || '';
const mongodb_host = process.env.AOZORA_MONGODB_HOST || 'localhost';
const mongodb_port = process.env.AOZORA_MONGODB_PORT || '27017';
const mongo_url = `mongodb://${mongodb_credential}${mongodb_host}:${mongodb_port}/aozora`;

const DEFAULT_LIMIT = 100;

//
// app and router
//
const app = new Koa();
const router = new Router();

//
// middleware
//
app.use(compress());
app.use(serve('./public'));
app.use(morgan('combined', { stream: accessLogStream }));
app.use(koabody());

//
// utilities
//

const re_or_str = (src) => {
  if (src[0] === '/' && src.slice(-1) === '/') {
    return {"$in": [new RegExp(src.slice(1, -1))]};
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
// books
//
router.get('/books', async (ctx, next) => {
  let req = ctx.request;
  let query = {};

  if (req.query.title) {
    query['title'] = re_or_str(req.query.title);
  }
  if (req.query.author) {
    query['authors.full_name'] = re_or_str(req.query.author);
  }
  if (req.query.after) {
    query['release_date'] = {"$gte": new Date(req.query.after)};
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
    req.query.fields.split(',').forEach((a) => {
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
  // console.log(docs);
  if(docs) {
    return_json(ctx, docs);
  } else {
    ctx.body = '';
    ctx.status = 404;
  }
});

router.get('/books/:book_id', async (ctx, next) => {
  let book_id = parseInt(ctx.params.book_id);
  console.log(book_id);

  let doc = await app.my.books.findOne({book_id: book_id});
  if (doc) {
    return_json(ctx, doc);
  } else {
    ctx.body = '';
    ctx.status = 404;
  }
});

//
//
//

const run_server = async () => {
  let MongoClient = mongodb.MongoClient;
  let db = await MongoClient.connect(mongo_url);
  app.my = {};
  app.my.db = db;
  app.my.books = db.collection('books');
  app.my.authors = db.collection('authors');
  app.my.persons = db.collection('persons');
  app.my.workers = db.collection('workers');

  let port = process.env.PORT || 5000;

  //redis_url = process.env.REDIS_URL || "redis://127.0.0.1:6379"
  //  app.my.rc = redis.createClient(redis_url, {return_buffers: true})
}

run_server();

app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(process.env.PORT || 3000);
