# sql-builder.js

[![Badge](https://img.shields.io/badge/link-996.icu-%23FF4D5B.svg?style=flat-square)](https://996.icu/#/en_US)
[![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg?style=flat-square)](https://github.com/996icu/996.ICU/blob/master/LICENSE)
![Node](https://img.shields.io/badge/node-%3E=14-blue.svg?style=flat-square)
[![npm version](https://badge.fury.io/js/sql-builder.js.svg)](https://badge.fury.io/js/sql-builder.js)

A lightweight and flexible SQL query builder for javascript applications.

## Installation

```bash
npm install sql-builder.js --save
```

## Usage

```js
import { SQLBuilder } from "sql-builder.js";

// Initialize the sqlite process
const sqlBuilder = new SQLBuilder();

const { sql, params } = sqlBuilder.select("*").from("users").where("age", ">", 18).build();

console.log(sql); // SELECT * FROM `users` WHERE `age` > ?
console.log(params); // [18]
```

## License

The [Anti 996 License](LICENSE)
