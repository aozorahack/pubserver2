import fs from 'fs';
import serve from 'koa-static';
import morgan from 'koa-morgan';
import koabody from 'koa-body';
import compress from 'koa-compress';
import Router from 'koa-router';
import Koa from 'koa';

const accessLogStream = fs.createWriteStream('./access.log',
                                             { flags: 'a' });
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
router.get('/books/:book_id', (ctx, next) => {
  let book_id = parseInt(ctx.params.book_id);
  console.log(book_id);
  
  ctx.body = `book_id = ${book_id}`;
});

//
//
//
app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000);
