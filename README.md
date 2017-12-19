# pubserver2
Prototype of Aozora-bunko package management server prototype

青空文庫の作品の情報を配布するためのAPIサーバのプロトタイプです。CoffeeScriptで記述していた Pubserver

## 動かし方

### 前提条件
* Node.js
* MongoDB (データ格納用)
* Redis (取得データのキャッシュ用)

### コマンドラインでの起動
```sh
$ npm install
$ npm start
```

### 環境変数

* `AOZORA_MONGODB_CREDENTIAL` MongoDBにアクセスするユーザ名・パスワード "*username*:*password*@" (default: "")
* `AOZORA_MONGODB_HOST` MongoDBのホスト名 (default: "localhost")
* `AOZORA_MONGODB_PORT` MongoDBのポート番号 (default: 27017)
* `PORT` pubserverの待ち受けポート番号 (default: 5000)


## APIアクセス方法

以下は heroku.com で仮稼働しているプロトタイプサーバのURLです。
ローカルで動かす時にはホスト名を "localhost:5000"で適宜読み替えてください。

#### 作品のリストの取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/books
```

追加パラメータ

 - `title`: タイトル名でのフィルタ
 - `author`: 著者名でのフィルタ
 - `fields`: 取得する属性を指定
 - `limit`: 取得するアイテム数を制限
 - `skip`: 指定した分のアイテムをスキップしてそれ以降を取得
 - `after`: release_dateがこの日付よりも新しいモノのみを返す(YYYY-MM-DD)

#### 個別の作品の情報の取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/books/{book_id}
```

#### 作品のカードを取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/books/{book_id}/card
```

#### 作品の中身をテキストで取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/books/{book_id}/content?format=txt
```

#### 作品の中身をhtmlで取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/books/{book_id}/content?format=html
```

#### 人物情報のリストの取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/persons
```

追加パラメータ
 - `name`: 著者名・訳者名でのフィルタ


#### 個別の人物の情報の取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/persons/{person_id}
```

#### 工作員情報のリストの取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/workers
```

追加パラメータ
 - `name`: 工作員名でのフィルタ

#### 個別の工作員の情報の取得
```
curl http://pubserver2.herokuapp.com/api/v0.1/workers/{worker_id}
```

## DBにデータ登録するためのスクリプト

[こちら](https://github.com/aozorahack/db_importer)を参照下さい