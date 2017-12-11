const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const serve = require('koa-static-server');
const morgan = require('koa-morgan');
const koabody = require('koa-body');
const compress = require('koa-compress');
const Router = require('koa-router');
const Koa = require('koa');

const mongodb = require('mongodb');
const redis = require('redis');
const rp = require('request-promise');
const iconv = require('iconv-lite');
const JSZip = require('jszip');

const access_log= fs.createWriteStream('./access.log', { flags: 'a' });

const mongodb_credential = process.env.AOZORA_MONGODB_CREDENTIAL || '';
const mongodb_host = process.env.AOZORA_MONGODB_HOST || 'localhost';
const mongodb_port = process.env.AOZORA_MONGODB_PORT || '27017';
const mongo_url = `mongodb://${mongodb_credential}${mongodb_host}:${mongodb_port}/aozora`;
const redis_url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const encodings = {
  card: 'utf-8',
  html: 'shift_jis'
};

const DEFAULT_LIMIT = 100;
const DATA_LIFETIME = 3600;

const VERSION = 'v0.1';
const API_ROOT = `/api/${VERSION}`;

//
// promisify
//
const promisify = require('util').promisify;
const zlib_deflate = promisify(zlib.deflate);
const zlib_inflate = promisify(zlib.inflate);

redis.RedisClient.prototype.setex = promisify(redis.RedisClient.prototype.setex);
redis.RedisClient.prototype.get = promisify(redis.RedisClient.prototype.get);

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
  ctx.response.etag = gen_etag(body);
  ctx.status = 200;

  if (ctx.fresh) {
    ctx.status = 304;
    ctx.body = null;
  } else {
    ctx.type = 'application/json; charset=utf-8';
    ctx.body = body;
  }
};

const upload_content_data = async (rc, key, data) => {
  let zdata = await zlib_deflate(data);
  let etag = gen_etag(zdata);
  await rc.setex(key, DATA_LIFETIME, zdata);
  await rc.setex(key + ':etag', DATA_LIFETIME, etag);
  return {text: data, etag: etag};
};

const add_ogp = (body, title, author)=> {
  const ogp_headers =
    ['<head prefix="og: http://ogp.me/ns#">',
     '<meta name="twitter:card" content="summary" />',
     '<meta property="og:type" content="book">',
     '<meta property="og:image" content="http://www.aozora.gr.jp/images/top_logo.png">',
     '<meta property="og:image:type" content="image/png">',
     '<meta property="og:image:width" content="100">',
     '<meta property="og:image:height" content="100">',
     '<meta property="og:description" content="...">',
     "<meta property=\"og:title\" content=\"#{title}(#{author})\""].join('\n');

  return body.replace(/<head>/, ogp_headers);
};

const rel_to_abs_path = (body, ext) => {
  if (ext == 'card') {
    return body
      .replace(/\.\.\/\.\.\//g, 'http://www.aozora.gr.jp/')
      .replace(/\.\.\//g, 'http://www.aozora.gr.jp/cards/');
  } else { // ext == 'html'
    return body
      .replace(/\.\.\/\.\.\//g, 'http://www.aozora.gr.jp/cards/');
  }
};

const get_zipped = async (my, book_id, ext) => {
  console.log(book_id, ext);
  let doc = await my.books.findOne({book_id: book_id}, {text_url: 1});

  console.log(doc.length);
  let body = await rp.get(doc.text_url,
                          { encoding: null,
                            headers: {
                              'User-Agent': 'Mozilla/5.0',
                              'Accept': '*/*'
                            }});
  console.log(body.length);
  const zip = await JSZip.loadAsync(body);
  console.log(zip);
  const key = Object.keys(zip.files)[0]; // assuming zip has only one text entry
  return zip.file(key).async('nodebuffer');
};

const get_ogpcard = async (my, book_id, ext) => {
  let doc = await my.books.findOne({book_id: book_id},
                                   {card_url: 1, html_url: 1,
                                    title:1, authors: 1});
  let ext_url = doc[`${ext}_url`];
  let body = await rp.get(ext_url,
                          { encoding: null,
                            headers: {
                              'User-Agent': 'Mozilla/5.0',
                              'Accept': '*/*'
                            }});
  let encoding = encodings[ext];
  let bodystr = iconv.decode(body, encoding);
  bodystr = add_ogp(bodystr, doc.title, doc.authors[0].full_name);
  bodystr = rel_to_abs_path(bodystr, ext);
  return iconv.encode(bodystr, encodings[ext]);
};

const get_from_cache = async (my, book_id, get_file, ext) => {
  const key = `${ext}${book_id}`;
  const result = await my.rc.get(key);
  if (result) {
    const data = await zlib_inflate(result);
    return {text: data, etag: await my.rc.get(key+':etag')};
  } else {
    const data = await get_file(my, book_id, ext);
    return await upload_content_data(my.rc, key, data);
  }
};

const gen_etag = (data) => {
  return crypto.createHash('sha1').update(data).digest('hex');
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

  my.rc = redis.createClient(redis_url, {return_buffers: true});

  return my;
};

const content_type = {
  'txt': 'text/plain; charset=shift_jis',
  'html': 'text/html; charset=shift_jis'
};

const get_file_method = {
  'txt': get_zipped,
  'html': get_ogpcard
}

const make_router = (app) => {
  const router = new Router({prefix: API_ROOT});

  //
  // books
  //
  router.get('/books', async (ctx) => {
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
      fields: {
        _id: 0
      }
    };

    if (req.query.sort) {
      options.sort = JSON.parse(req.query.sort);
    } else {
      options.sort = {release_date: -1};
    }

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

  router.get('/books/:book_id', async (ctx, next) => {
    let book_id = parseInt(ctx.params.book_id);
    if (!book_id) {
      next();
      return;
    }
    console.log(`/books/${book_id}`);
    let doc = await app.my.books.findOne({book_id: book_id});
    if (doc) {
      return_json(ctx, doc);
    } else {
      ctx.body = '';
      ctx.status = 404;
    }
  });

  router.get('/books/:book_id/card', async (ctx, next) => {
    let book_id = parseInt(ctx.params.book_id);
    console.log(`/books/${book_id}/card`);

    try {
      let res = await get_from_cache(app.my, book_id, get_ogpcard, 'card');

      ctx.status = 200;
      ctx.response.etag = res.etag;

      if (ctx.fresh) {
        ctx.status = 304;
        ctx.body = null;
      } else {
        ctx.response.type = 'text/html';
        ctx.body = res.text;
      }
    } catch (error) {
      console.error(error);
      ctx.body = '';
      ctx.status = 404;
    }
  });

  router.get('/books/:book_id/content', async (ctx, next) => {
    let book_id = parseInt(ctx.params.book_id);
    console.log(`/books/${book_id}/content?format=${ctx.query.format}`);

    const ext = ctx.query.format || 'txt';
    try {
      const get_file = get_file_method[ext];
      const res = await get_from_cache(app.my, book_id, get_file, ext);

      ctx.status = 200;
      ctx.response.etag = res.etag;

      if (ctx.fresh) {
        ctx.status = 304;
        ctx.body = null;
      } else {
        ctx.response.type = content_type[ext] || 'application/octet-stream';
        ctx.body = res.text;
      }
    } catch (error) {
      console.error(error);
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
  app.use(morgan('combined', { stream: access_log}));
  app.use(koabody());

  app.my = await connect_db();

  const router = make_router(app);
  app
    .use(router.routes())
    .use(router.allowedMethods());

  app.use(serve({rootDir: './public', rootPath: API_ROOT}));
  return app;
};

exports.make_app = make_app;
