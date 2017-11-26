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
  t.is(res.body.base_book_1_eidtion_proofing, '1985（昭和60）年11月10日改版38版');
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
      .set('If-None-Match', '"71a8c1720fe84eb38ba96dc92321a6a841640fdc"');
  
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
