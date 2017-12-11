import test from 'ava';
import request from 'supertest';
import {make_app} from '../app.js';

var server;

test.before(async t => {
  const app = await make_app();
  server = request(app.listen(0));
});

test('app:single_book', async t => {
  t.plan(33);
  var res = await server
      .get('/api/v0.1/books/123');

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.book_id, 123);
  t.is(res.body.title, '大川の水');
  t.is(res.body.title_yomi, 'おおかわのみず');
  t.is(res.body.title_sort, 'おおかわのみす');
  t.is(res.body.first_appearance, '「心の花」1914（大正3）年4月');
  t.is(res.body.ndc_code, 'NDC 914');
  t.is(res.body.font_kana_type, '新字新仮名');
  t.is(res.body.copyright, false);
  t.is(res.body.release_date, '1999-01-11T00:00:00.000Z');
  t.is(res.body.last_modified, '2014-09-17T00:00:00.000Z');
  t.is(res.body.card_url, 'http://www.aozora.gr.jp/cards/000879/card123.html');
  t.is(res.body.base_book_1, '羅生門・鼻・芋粥');
  t.is(res.body.base_book_1_publisher, '角川文庫、角川書店');
  t.is(res.body.base_book_1_1st_edition, '1950（昭和25）年10月20日');
  t.is(res.body.base_book_1_edition_input, '1985（昭和60）年11月10日改版38版');
  t.is(res.body.base_book_1_edition_proofing, '1985（昭和60）年11月10日改版38版');
  t.is(res.body.input, 'j.utiyama');
  t.is(res.body.proofing, 'かとうかおり');
  t.is(res.body.text_url, 'http://www.aozora.gr.jp/cards/000879/files/123_ruby_1199.zip');
  t.is(res.body.text_last_modified, '2004-03-15T00:00:00.000Z');
  t.is(res.body.text_encoding, 'ShiftJIS');
  t.is(res.body.text_charset, 'JIS X 0208');
  t.is(res.body.text_updated, 2);
  t.is(res.body.html_url, 'http://www.aozora.gr.jp/cards/000879/files/123_15167.html');
  t.is(res.body.html_last_modified, '2004-03-15T00:00:00.000Z');
  t.is(res.body.html_encoding, 'ShiftJIS');
  t.is(res.body.html_charset, 'JIS X 0208');
  t.is(res.body.html_updated, 0);
  t.is(res.body.authors[0].person_id, 879);
  t.is(res.body.authors[0].last_name, '芥川');
  t.is(res.body.authors[0].first_name, '竜之介');
});

test('app:single_book_etag', async t => {
  t.plan(2);

  var res = await server
      .get('/api/v0.1/books/123')
      .set('If-None-Match', '"9740c687b92e8a6e99b60d9dd8a3f1d72ebe89fc"');

  t.is(res.status, 304);
  t.is(res.header['content-type'], undefined);
});

test('app:single_book_notfuond', async t => {
  t.plan(1);

  var res = await server
      .get('/api/v0.1/books/12345');

  t.is(res.status, 404);
});

test('app:multiple_books', async t => {
  t.plan(3);

  var res = await server
      .get('/api/v0.1/books');

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 100);
});

test('app:multiple_books_title', async t => {
  t.plan(12);

  var res = await server
      .get('/api/v0.1/books')
      .query({'title': '吾輩は猫である'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 1);
  t.is(res.body[0].book_id, 789);
  t.is(res.body[0].title, '吾輩は猫である');

  var res = await server
      .get('/api/v0.1/books')
      .query({'title': 'あいびき'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 2);
  t.is(res.body[0].book_id, 4843);
  t.is(res.body[0].title, 'あいびき');
  t.is(res.body[1].book_id, 5);
  t.is(res.body[1].title, 'あいびき');

});

test('app:multiple_books_author', async t => {
  t.plan(5);

  var res = await server
      .get('/api/v0.1/books')
      .query({'author': '素木しづ'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 12);
  t.is(res.body[0].book_id, 48628);
  t.is(res.body[0].title, '追憶');
});

test('app:multiple_books_author_first_last_only', async t => {
  t.plan(10);

  let res = await server
      .get('/api/v0.1/books')
      .query({'author': '芥川'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 100);
  t.is(res.body[0].book_id, 56820);
  t.is(res.body[0].title, '仏蘭西文学と僕');

  res = await server
      .get('/api/v0.1/books')
      .query({'author': '独歩'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 45);
  t.is(res.body[0].book_id, 56412);
  t.is(res.body[0].title, '日の出');
});

test('app:books_fields', async t => {
  t.plan(9);

  let res = await server
      .get('/api/v0.1/books')
      .query({'title':'鼻', 'fields': ['title', 'release_date']});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 2);
  t.is(res.body[0].book_id, undefined);
  t.is(res.body[0].title, '鼻');
  t.is(res.body[0].release_date, '1999-01-26T00:00:00.000Z');
  t.is(res.body[1].book_id, undefined);
  t.is(res.body[1].title, '鼻');
  t.is(res.body[1].release_date, '1997-11-04T00:00:00.000Z');
});

test('app:books_limit_skip', async t => {
  t.plan(15);

  let res = await server
      .get('/api/v0.1/books')
      .query({'title':'/花/', limit: 200});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 185);

  res = await server
    .get('/api/v0.1/books')
    .query({'title':'/花/', limit: 20, skip:100, sort: '{"release_date": 1}'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 20);

  t.is(res.body[0].book_id, 48246);
  t.is(res.body[0].title, '白い花');
  t.is(res.body[0].release_date, '2008-07-15T00:00:00.000Z');

  res = await server
    .get('/api/v0.1/books')
    .query({'title':'/花/', limit: 10, skip:180, sort: '{"release_date": 1}'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.true(res.body.length >= 5 && res.body.length <= 10);

  t.is(res.body[0].book_id, 55753);
  t.is(res.body[0].title, '雪と花火余言');
  t.is(res.body[0].release_date, '2017-02-12T00:00:00.000Z');

});
test('app:books_limit_skip', async t => {
  t.plan(6);

  let res = await server
      .get('/api/v0.1/books')
      .query({'title':'/月/', limit: 50, sort: '{"release_date": 1}',
              after: '2009-01-01'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 50);

  t.is(res.body[0].book_id, 49545);
  t.is(res.body[0].title, '正月の思い出');
  t.is(res.body[0].release_date, '2009-01-10T00:00:00.000Z');

});

test('app:books_card', async t => {
  t.plan(5);

  const path = '/api/v0.1/books/123/card';
  let res = await server
      .get(path);

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'text/html; charset=utf-8');
  t.is(res.text.length, 8111);

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag);

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:books_content_text', async t => {
  t.plan(5);

  const path = '/api/v0.1/books/123/content';
  let res = await server
      .get(path)
      .query({format: 'txt'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'text/plain; charset=shift_jis');
  t.is(res.text.length, 7757);

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag);

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:books_content_html', async t => {
  t.plan(5);

  const path = '/api/v0.1/books/123/content';
  let res = await server
      .get(path)
      .query({format: 'html'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'text/html; charset=shift_jis');
  t.is(res.text.length, 14332);

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag)
    .query({format: 'html'});

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:persons', async t => {
  t.plan(5);

  const path = '/api/v0.1/persons';
  let res = await server
      .get(path);

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 988);

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag)
    .query({format: 'html'});

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:persons_name', async t => {
  t.plan(20);

  const path = '/api/v0.1/persons';
  let res = await server
      .get(path)
      .query({'name': '鈴木'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 6);

  res = await server
      .get(path)
      .query({'name': '鈴木梅太郎'});

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 1);
  t.is(res.body[0].person_id, 957);
  t.is(res.body[0].last_name, '鈴木');
  t.is(res.body[0].first_name, '梅太郎');
  t.is(res.body[0].last_name_yomi, 'すずき');
  t.is(res.body[0].first_name_yomi, 'うめたろう');
  t.is(res.body[0].last_name_sort, 'すすき');
  t.is(res.body[0].first_name_sort, 'うめたろう');
  t.is(res.body[0].last_name_roman, 'Suzuki');
  t.is(res.body[0].first_name_roman, 'Umetaro');
  t.is(res.body[0].date_of_birth, '1874-04-07T00:00:00.000Z');
  t.is(res.body[0].date_of_death, '1943-09-20T00:00:00.000Z');
  t.is(res.body[0].author_copyright, false );

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag)
    .query({'name': '鈴木梅太郎'});

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});
