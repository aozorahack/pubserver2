const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const serve = require('koa-static-server');
const morgan = require('koa-morgan');
const koabody = require('koa-body');
const compress = require('koa-compress');
const Router = require('koa-router');
const cors = require('@koa/cors');
const Koa = require('koa');

const db = require('./db_mongo');

require('dotenv').config();

const redis = require('redis');
const axios = require('axios').create({
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': '*/*'
  },
  responseType: 'arraybuffer',
});
const iconv = require('iconv-lite');
const JSZip = require('jszip');

const access_log = fs.createWriteStream('./access.log', {
  flags: 'a'
});

const redis_url = process.env.AOZORA_REDIS_URL || 'redis://127.0.0.1:6379';

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

const rc = redis.createClient(redis_url, {
  return_buffers: true
});

//
// utilities
//

const re_or_str = (src) => {
  if (src[0] === '/' && src.slice(-1) === '/') {
    return new RegExp(src.slice(1, -1));
  } else {
    return src;
  }
};

const return_json = (ctx, doc) => {
  const body = JSON.stringify(doc);
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

const return_error = (ctx, status) => {
  ctx.body = '';
  ctx.status = status;
};

const return_data = (ctx, text, ctype) => {
  ctx.status = 200;
  ctx.response.type = ctype;
  ctx.body = text;
};

const return_null = (ctx, status) => {
  ctx.body = null;
  ctx.status = status;
};

const set_etag = (ctx, etag) => {
  ctx.status = 200;
  ctx.response.etag = etag;
};

const upload_content_data = async (key, data) => {
  const zdata = await zlib_deflate(data);
  const etag = gen_etag(zdata);
  await rc.setex(key + ':d', DATA_LIFETIME, zdata);
  await rc.setex(key, DATA_LIFETIME, etag);
  return {
    text: data,
    etag: etag
  };
};

const add_ogp = (body, title, author) => {
  const ogp_headers = `<head prefix="og: http://ogp.me/ns#">
<meta name="twitter:card" content="summary" />
<meta property="og:type" content="book">
<meta property="og:image" content="http://www.aozora.gr.jp/images/top_logo.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="100">
<meta property="og:image:height" content="100">
<meta property="og:description" content="...">
<meta property="og:title" content="${title}(${author})"`;

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

const get_zipped = async (db, book_id, _) => {
  const doc = await db.find_one_book(book_id, ['text_url']);

  const resp = await axios.get(doc.text_url);
  // console.log(resp);
  const body = resp.data;
  const zip = await JSZip.loadAsync(body);
  const key = Object.keys(zip.files)[0]; // assuming zip has only one text entry
  return zip.file(key).async('nodebuffer');
};

const get_ogpcard = async (db, book_id, ext) => {
  const doc = await db.find_one_book(book_id, {
    card_url: 1,
    html_url: 1,
    title: 1,
    authors: 1
  });
  const ext_url = doc[`${ext}_url`];
  const resp = await axios.get(ext_url);
  const body = resp.data;
  const encoding = encodings[ext];
  const author_name = doc.authors[0].last_name + doc.authors[0].first_name;
  return iconv.encode(rel_to_abs_path(add_ogp(iconv.decode(body, encoding), doc.title, author_name), ext), encoding);
};

const get_from_cache = async (db, book_id, get_file, ext) => {
  const key = `${ext}${book_id}`;
  const etag = await rc.get(key);
  if (etag) {
    return {
      text: await zlib_inflate(await rc.get(key + ':d')),
      etag: etag
    };
  } else {
    const data = await get_file(db, book_id, ext);
    return await upload_content_data(key, data);
  }
};

const gen_etag = (data) => {
  return crypto.createHash('sha1').update(data).digest('hex');
};

//
// make router and app
//

const content_type = {
  'txt': 'text/plain; charset=shift_jis',
  'html': 'text/html; charset=shift_jis'
};

const get_file_method = {
  'txt': get_zipped,
  'html': get_ogpcard
};

const make_router = (app) => {
  const router = new Router({
    prefix: API_ROOT
  });

  //
  // books
  //
  router.get('/books', async (ctx) => {
    const req = ctx.request;
    const query = {};

    if (req.query.title) {
      query.title = re_or_str(req.query.title);
    }
    if (req.query.author) {
      const persons = await app.db.find_persons({
        $where: `var author = "${req.query.author}"; this.last_name + this.first_name == author || this.last_name == author || this.first_name == author`
      });
      if (persons.length == 0) {
        return_error(ctx, 404);
        return;
      }
      query['authors.person_id'] = {
        $in: (await persons).map(e => e.person_id)
      };
    }

    if (req.query.after) {
      query.release_date = {
        '$gte': new Date(req.query.after)
      };
    }

    const options = {};
    options.sort = req.query.sort ? JSON.parse(req.query.sort) : {
      release_date: -1
    };
    options.limit = req.query.limit ? parseInt(req.query.limit) : DEFAULT_LIMIT;
    if (req.query.skip) {
      options.skip = parseInt(req.query.skip);
    }

    const docs = await app.db.find_books(query, options);
    if (docs) {
      return_json(ctx, docs);
    } else {
      return_error(ctx, 404);
    }
  });

  router.get('/books/:book_id', async (ctx, next) => {
    console.log(decodeURIComponent(ctx.req.url)); // eslint-disable-line no-console

    const book_id = parseInt(ctx.params.book_id);
    if (!book_id) {
      next();
      return;
    }
    const doc = await app.db.find_one_book(book_id);
    if (doc) {
      return_json(ctx, doc);
    } else {
      return_error(ctx, 404);
    }
  });

  router.get('/books/:book_id/card', async (ctx) => {
    console.log(decodeURIComponent(ctx.req.url)); // eslint-disable-line no-console

    const book_id = parseInt(ctx.params.book_id);
    try {
      const res = await get_from_cache(app.db, book_id, get_ogpcard, 'card');

      set_etag(ctx, res.etag);
      if (ctx.fresh) {
        return_null(ctx, 304);
      } else {
        return_data(ctx, res.text, 'text/html');
      }
    } catch (error) {
      console.error(error);
      return_error(404);
    }
  });

  router.get('/books/:book_id/content', async (ctx) => {
    console.log(decodeURIComponent(ctx.req.url)); // eslint-disable-line no-console

    const book_id = parseInt(ctx.params.book_id);
    const ext = ctx.query.format || 'txt';
    try {
      const get_file = get_file_method[ext];
      const res = await get_from_cache(app.db, book_id, get_file, ext);

      set_etag(ctx, res.etag);

      if (ctx.fresh) {
        return_null(ctx, 304);
      } else {
        return_data(ctx, res.text, content_type[ext] || 'application/octet-stream');
      }
    } catch (error) {
      console.error(error);
      return_error(404);
    }
  });

  //
  // persons
  //
  router.get('/persons', async (ctx) => {
    console.log(decodeURIComponent(ctx.req.url)); // eslint-disable-line no-console

    const req = ctx.request;
    const query = {};

    if (req.query.name) {
      query['$where'] = `var name = "${req.query.name}"; this.last_name + this.first_name == name || this.last_name == name || this.first_name == name`;
    }

    const docs = await app.db.find_persons(query);
    if (docs) {
      return_json(ctx, docs);
    } else {
      return_error(ctx, 404);
    }
  });

  router.get('/persons/:person_id', async (ctx, next) => {
    console.log(decodeURIComponent(ctx.req.url)); // eslint-disable-line no-console

    const person_id = parseInt(ctx.params.person_id);
    if (!person_id) {
      next();
      return;
    }
    const doc = await app.db.find_one_person(person_id);
    if (doc) {
      return_json(ctx, doc);
    } else {
      return_error(ctx, 404);
    }
  });

  //
  // workers
  //
  router.get('/workers', async (ctx) => {
    console.log(decodeURIComponent(ctx.req.url)); // eslint-disable-line no-console

    const req = ctx.request;
    const query = {};

    if (req.query.name) {
      query.name = re_or_str(req.query.name);
    }

    const docs = await app.db.find_workers(query);
    if (docs) {
      return_json(ctx, docs);
    } else {
      return_error(ctx, 404);
    }
  });

  router.get('/workers/:worker_id', async (ctx, next) => {
    console.log(decodeURIComponent(ctx.req.url)); // eslint-disable-line no-console

    const worker_id = parseInt(ctx.params.worker_id);
    if (!worker_id) {
      next();
      return;
    }
    const doc = await app.db.find_one_worker(worker_id);
    if (doc) {
      return_json(ctx, doc);
    } else {
      return_error(ctx, 404);
    }
  });

  //
  // ranking
  //
  router.get('/ranking/:type/:year/:month', async (ctx) => {
    console.log(decodeURIComponent(ctx.req.url)); // eslint-disable-line no-console

    const query = {
      year_month: ctx.params.year + '_' + ctx.params.month,
      type: ctx.params.type
    };

    const docs = await app.db.find_ranking(query);
    if (docs) {
      return_json(ctx, docs);
    } else {
      return_error(ctx, 404);
    }
  });

  return router;
};


//
// application
//

const make_app = async () => {
  const app = new Koa();
  //
  // middleware
  //
  app.use(cors());
  app.use(compress());
  app.use(morgan('combined', {
    stream: access_log
  }));
  app.use(koabody());

  app.db = new db.DB();
  await app.db.connect();

  const router = make_router(app);
  app
    .use(router.routes())
    .use(router.allowedMethods());

  app.use(serve({
    rootDir: './public',
    rootPath: API_ROOT
  }));

  rc.flushall();

  return app;
};

exports.make_app = make_app;