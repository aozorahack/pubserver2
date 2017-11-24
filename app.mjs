import fs from 'fs';
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
// books
//
router.get('/books/:book_id', async (ctx, next) => {
  let book_id = parseInt(ctx.params.book_id);
  console.log(book_id);
  let doc = await app.my.books.findOne({book_id: book_id});
  // console.log(doc);
  if (doc) {
    ctx.body = doc;
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

app.listen(3000);
