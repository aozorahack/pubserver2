require('dotenv').config();

const mongodb = require('mongodb');

const mongodb_credential = process.env.AOZORA_MONGODB_CREDENTIAL || '';
const mongodb_host = process.env.AOZORA_MONGODB_HOST || 'localhost';
const mongodb_port = process.env.AOZORA_MONGODB_PORT || '27017';
const mongo_url = `mongodb://${mongodb_credential}${mongodb_host}:${mongodb_port}/aozora`;

class DB {
  async connect() {
    return (mongodb.MongoClient).connect(mongo_url)
      .then((db) => {
        this.db = db;
      });
  }

  _find_one(collection, query, options) {
    options = options || {};
    options.fields = Object.assign({_id:0}, ...(options.fields || []).map(e => ({[e]: 1})));
    return collection.findOne(query, options);
  }

  _find_item(collection, query, options) {
    options = options || {};
    options.fields = Object.assign({_id:0}, ...(options.fields || []).map(e => ({[e]: 1})));
    return collection.find(query, options);
  }

  find_one_book(book_id, options) {
    return this._find_one(this.db.collection('books'), {book_id: book_id}, options);
  }

  find_books(query, options) {
    return this._find_item(this.db.collection('books'), query, options);
  }

  find_one_person(person_id, options) {
    return this._find_one(this.db.collection('persons'), {person_id: person_id}, options);
  }

  find_persons(query, options) {
    return this._find_item(this.db.collection('persons'), query, options);
  }

  find_one_worker(worker_id, options) {
    return this._find_one(this.db.collection('workers'), {id: worker_id}, options);
  }

  find_workers(query, options) {
    return this._find_item(this.db.collection('workers'), query, options);
  }
}

exports.DB = DB;
