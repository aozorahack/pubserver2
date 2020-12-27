const test = require('ava');
const request = require('supertest');
const {make_app} = require('../app.js');

var server;

test.before(async () => {
  const app = await make_app();
  server = request(app.listen(0));
});

test('app:single_book', async t => {
  t.plan(35);
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
  t.is(res.body.card_url, 'https://www.aozora.gr.jp/cards/000879/card123.html');
  t.is(res.body.base_book_1, '羅生門・鼻・芋粥');
  t.is(res.body.base_book_1_publisher, '角川文庫、角川書店');
  t.is(res.body.base_book_1_1st_edition, '1950（昭和25）年10月20日');
  t.is(res.body.base_book_1_edition_input, '1985（昭和60）年11月10日改版38版');
  t.is(res.body.base_book_1_edition_proofing, '1985（昭和60）年11月10日改版38版');
  t.is(res.body.input, 'j.utiyama');
  t.is(res.body.proofing, 'かとうかおり');
  t.is(res.body.text_url, 'https://www.aozora.gr.jp/cards/000879/files/123_ruby_1199.zip');
  t.is(res.body.text_last_modified, '2004-03-15T00:00:00.000Z');
  t.is(res.body.text_encoding, 'ShiftJIS');
  t.is(res.body.text_charset, 'JIS X 0208');
  t.is(res.body.text_updated, 2);
  t.is(res.body.html_url, 'https://www.aozora.gr.jp/cards/000879/files/123_15167.html');
  t.is(res.body.html_last_modified, '2004-03-15T00:00:00.000Z');
  t.is(res.body.html_encoding, 'ShiftJIS');
  t.is(res.body.html_charset, 'JIS X 0208');
  t.is(res.body.html_updated, 0);
  t.is(res.body.authors[0].person_id, 879);
  t.is(res.body.authors[0].last_name, '芥川');
  t.is(res.body.authors[0].first_name, '竜之介');

  res = await server
    .get('/api/v0.1/books/123')
    .set('If-None-Match', res.header.etag);

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
    .query({
      'title': '吾輩は猫である'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 1);
  t.is(res.body[0].book_id, 789);
  t.is(res.body[0].title, '吾輩は猫である');

  res = await server
    .get('/api/v0.1/books')
    .query({
      'title': 'あいびき'
    });

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
    .query({
      'author': '素木しづ'
    });

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
    .query({
      'author': '芥川'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 100);
  t.is(res.body[0].book_id, 60159);
  t.is(res.body[0].title, '四人');

  res = await server
    .get('/api/v0.1/books')
    .query({
      'author': '独歩'
    });

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
    .query({
      'title': '鼻',
      'fields': ['title', 'release_date']
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 2);
  t.is(res.body[0].book_id, 372);
  t.is(res.body[0].title, '鼻');
  t.is(res.body[0].release_date, '1999-01-26T00:00:00.000Z');
  t.is(res.body[1].book_id, 42);
  t.is(res.body[1].title, '鼻');
  t.is(res.body[1].release_date, '1997-11-04T00:00:00.000Z');
});

test('app:books_limit_skip', async t => {
  t.plan(15);

  let res = await server
    .get('/api/v0.1/books')
    .query({
      'title': '/花/',
      limit: 200
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.true(res.body.length >= 186);

  res = await server
    .get('/api/v0.1/books')
    .query({
      'title': '/花/',
      limit: 20,
      skip: 100,
      sort: '{"release_date": 1}'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 20);

  t.is(res.body[0].book_id, 48246);
  t.is(res.body[0].title, '白い花');
  t.is(res.body[0].release_date, '2008-07-15T00:00:00.000Z');

  res = await server
    .get('/api/v0.1/books')
    .query({
      'title': '/花/',
      limit: 10,
      skip: 180,
      sort: '{"release_date": 1}'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.true(res.body.length >= 5 && res.body.length <= 10);

  t.is(res.body[0].book_id, 55753);
  t.is(res.body[0].title, '雪と花火余言');
  t.is(res.body[0].release_date, '2017-02-12T00:00:00.000Z');

});
test('app:books_limit_after', async t => {
  t.plan(6);

  let res = await server
    .get('/api/v0.1/books')
    .query({
      'title': '/月/',
      limit: 50,
      sort: '{"release_date": 1}',
      after: '2009-01-01'
    });

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
  t.is(res.text.length, 8733);

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
    .query({
      format: 'txt'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'text/plain; charset=shift_jis');
  t.is(res.text.length, 7982);

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
    .query({
      format: 'html'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'text/html; charset=shift_jis');
  t.is(res.text.length, 14615);

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag)
    .query({
      format: 'html'
    });

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
  t.true(res.body.length >= 998);

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag);

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:persons_name', async t => {
  t.plan(20);

  const path = '/api/v0.1/persons';
  let res = await server
    .get(path)
    .query({
      'name': '鈴木'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 7);

  res = await server
    .get(path)
    .query({
      'name': '鈴木梅太郎'
    });

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
  t.is(res.body[0].date_of_birth, '1874-04-07');
  t.is(res.body[0].date_of_death, '1943-09-20');
  t.is(res.body[0].author_copyright, false);

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag)
    .query({
      'name': '鈴木梅太郎'
    });

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:persons_name_by_id', async t => {
  t.plan(16);

  const path = '/api/v0.1/persons/1234';
  let res = await server
    .get(path);

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.person_id, 1234);
  t.is(res.body.last_name, '愛知');
  t.is(res.body.first_name, '敬一');
  t.is(res.body.last_name_yomi, 'あいち');
  t.is(res.body.first_name_yomi, 'けいいち');
  t.is(res.body.last_name_sort, 'あいち');
  t.is(res.body.first_name_sort, 'けいいち');
  t.is(res.body.last_name_roman, 'Aichi');
  t.is(res.body.first_name_roman, 'Keiichi');
  t.is(res.body.date_of_birth, '1880-07-25');
  t.is(res.body.date_of_death, '1923-06-23');
  t.is(res.body.author_copyright, false);

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag);

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:workers', async t => {
  t.plan(7);

  const path = '/api/v0.1/workers';
  let res = await server
    .get(path);

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.true(res.body.length >= 1003);
  t.true(typeof res.body[0].id == 'number');
  t.true(typeof res.body[0].name == 'string');

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag);

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:workers_name', async t => {
  t.plan(10);

  const path = '/api/v0.1/workers';
  let res = await server
    .get(path)
    .query({
      'name': '/高橋/'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.true(res.body.length >= 10);

  res = await server
    .get(path)
    .query({
      'name': 'しりかげる'
    });

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 1);
  t.is(res.body[0].id, 925);
  t.is(res.body[0].name, 'しりかげる');

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag)
    .query({
      'name': 'しりかげる'
    });

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:workers_name_by_id', async t => {
  t.plan(6);

  const path = '/api/v0.1/workers/1021';
  let res = await server
    .get(path);

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.id, 1021);
  t.is(res.body.name, '高橋征義');

  res = await server
    .get(path)
    .set('If-None-Match', res.header.etag);

  t.is(res.status, 304);
  t.is(res.text.length, 0);
});

test('app:ranking', async t => {
  t.plan(10);

  const path = '/api/v0.1/ranking/xhtml/2018/05/';
  let res = await server
    .get(path);

  t.is(res.status, 200);
  t.is(res.header['content-type'], 'application/json; charset=utf-8');
  t.is(res.body.length, 500);
  const ranking_1 = res.body[0];
  t.is(ranking_1.book_id, 624);
  t.is(ranking_1.access, 29323);
  t.is(ranking_1.title, '山月記');
  t.is(ranking_1.authors.length, 1);
  t.is(ranking_1.authors[0], '中島 敦');

  const ranking_104 = res.body[104];
  t.is(ranking_104.book_id, 622);
  t.is(ranking_104.access, 1167);


});
