require('dotenv').config();

const mongodb = require('mongodb');

const mongodb_credential = process.env.AOZORA_MONGODB_CREDENTIAL || '';
const mongodb_host = process.env.AOZORA_MONGODB_HOST || 'localhost';
const mongodb_port = process.env.AOZORA_MONGODB_PORT || '27017';
const mongo_url = `mongodb://${mongodb_credential}${mongodb_host}:${mongodb_port}/aozora`;

class DB {
  connect() {
    return (mongodb.MongoClient).connect(mongo_url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }).then((client) => {
      this.db = client.db();
    });
  }

  _find_one(collection, query, options) {
    options = options || {};
    if (Array.isArray(options.fields)) {
      options.fields = Object.assign({
        _id: 0
      }, ...(options.fields || []).map(e => ({
        [e]: 1
      })));
    } else {
      options.fields = options.fields || {};
      options.fields._id = 0;
    }
    return collection.findOne(query, options);
  }

  _find_item(collection, query, options) {
    options = options || {};
    if (Array.isArray(options.fields)) {
      options.fields = Object.assign({
        _id: 0
      }, ...(options.fields || []).map(e => ({
        [e]: 1
      })));
    } else {
      options.fields = options.fields || {};
      options.fields._id = 0;
    }
    return collection.find(query, options);
  }

  find_one_book(book_id, options) {
    return this._find_one(this.db.collection('books'), {
      book_id: book_id
    }, options);
  }

  find_books(query, options) {
    return this._find_item(this.db.collection('books'), query, options).toArray();
  }

  find_one_person(person_id, options) {
    return this._find_one(this.db.collection('persons'), {
      person_id: person_id
    }, options);
  }

  find_persons(query, options) {
    return this._find_item(this.db.collection('persons'), query, options).toArray();
  }

  find_one_worker(worker_id, options) {
    return this._find_one(this.db.collection('workers'), {
      id: worker_id
    }, options);
  }

  find_workers(query, options) {
    return this._find_item(this.db.collection('workers'), query, options).toArray();
  }

  find_ranking(query, options) {
    const collection = 'ranking_' + query.type;
    delete query.type;
    options = {
      fields: {
        year_month: 0
      },
      sort: {
        access: -1
      }
    };
    const book_options = {
      book_title: 1,
      authors: 1
    };
    return this._find_item(this.db.collection(collection), query, options).toArray()
      .then((a) => {
        return Promise.all(a.map((e) => {
          return this.find_one_book(e.book_id, book_options).then((book) => {
            e.title = book.title;
            e.authors = book.authors.map((a) => a.last_name + ' ' + a.first_name);
            return e;
          });
        }));
      });
  }
}

exports.DB = DB;