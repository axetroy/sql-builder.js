# sql-builder.js

[![Badge](https://img.shields.io/badge/link-996.icu-%23FF4D5B.svg?style=flat-square)](https://996.icu/#/en_US)
[![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg?style=flat-square)](https://github.com/996icu/996.ICU/blob/master/LICENSE)
![Node](https://img.shields.io/badge/node-%3E=14-blue.svg?style=flat-square)
[![npm version](https://badge.fury.io/js/sql-builder.js.svg)](https://badge.fury.io/js/sql-builder.js)

A lightweight and flexible SQL query builder for JavaScript and TypeScript applications with **built-in SQL injection protection**.

English | [中文](./README.zh-CN.md)

## Features

✨ **Safe by Design**: Built-in SQL injection protection with parameterized queries and identifier validation  
🎯 **Type Safe**: Full TypeScript support with type definitions  
🚀 **Zero Dependencies**: Lightweight with no external dependencies  
⚡ **High Performance**: Optimized for speed with cached regex patterns and efficient string building  
🔧 **Flexible API**: Fluent chainable interface for building complex queries  
📦 **Dual Module Support**: Works with both ESM and CommonJS  
🛡️ **Security First**: Operator whitelisting and identifier validation to prevent SQL injection

## Installation

```bash
npm install sql-builder.js --save
```

## Quick Start

```js
import { SQLBuilder } from "sql-builder.js";

// Create a new SQLBuilder instance
const sqlBuilder = new SQLBuilder();

// Build a simple SELECT query
const result = sqlBuilder
  .select("*")
  .from("users")
  .where("age", ">", 18)
  .build();

console.log(result.sql);         // SELECT * FROM `users` WHERE `age` > ?
console.log(result.params);      // [18]
console.log(result.toString());  // SELECT * FROM `users` WHERE `age` > 18

// Destructuring still works as before
const { sql, params } = result;
```

## Table of Contents

- [Basic Usage](#basic-usage)
  - [SELECT Queries](#select-queries)
  - [INSERT Queries](#insert-queries)
  - [UPDATE Queries](#update-queries)
  - [DELETE Queries](#delete-queries)
  - [UPSERT Queries](#upsert-queries)
- [Advanced Features](#advanced-features)
  - [WHERE Conditions](#where-conditions)
  - [JOIN Operations](#join-operations)
  - [Sorting and Grouping](#sorting-and-grouping)
  - [Pagination](#pagination)
  - [Pagination with Total Count](#pagination-with-total-count)
  - [Raw SQL Expressions](#raw-sql-expressions)
  - [Row-Level Locking](#row-level-locking)
  - [Transactions](#transactions)
- [Security Features](#security-features)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)

## Basic Usage

### SELECT Queries

#### Select All Columns

```js
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .build();
// SELECT * FROM `users`
```

#### Select Specific Columns

```js
const { sql, params } = sqlBuilder
  .select(["id", "name", "email"])
  .from("users")
  .build();
// SELECT `id`, `name`, `email` FROM `users`
```

#### Select with Table Alias

```js
const { sql, params } = sqlBuilder
  .select(["u.id", "u.name", "u.email"])
  .from("users u")
  .build();
// SELECT `u`.`id`, `u`.`name`, `u`.`email` FROM `users` `u`
```

#### Select with WHERE Clause

```js
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .where("status", "active")
  .where("age", ">=", 18)
  .build();
// SELECT * FROM `users` WHERE `status` = ? AND `age` >= ?
// params: ['active', 18]
```

### INSERT Queries

```js
const { sql, params } = sqlBuilder
  .insert("users", {
    name: "John Doe",
    email: "john@example.com",
    age: 25,
    status: "active"
  })
  .build();
// INSERT INTO `users` (`name`, `email`, `age`, `status`) VALUES (?, ?, ?, ?)
// params: ['John Doe', 'john@example.com', 25, 'active']
```

### UPDATE Queries

```js
const { sql, params } = sqlBuilder
  .update("users")
  .set({
    name: "Jane Doe",
    age: 26
  })
  .where("id", 1)
  .build();
// UPDATE `users` SET `name` = ?, `age` = ? WHERE `id` = ?
// params: ['Jane Doe', 26, 1]
```

#### Raw SQL Expressions in UPDATE

Use `raw()` to embed a SQL expression directly in a `SET` clause — for example, to increment a column relative to its current value:

```js
import { SQLBuilder, raw } from "sql-builder.js";

// Shorthand: set(column, value) — plain value
const { sql, params } = sqlBuilder
  .update("users")
  .set("age", 26)
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = ? WHERE `id` = ?
// params: [26, 1]

// Shorthand: set(column, raw()) — raw SQL expression
sqlBuilder
  .update("users")
  .set("age", raw("age + 1"))
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
// params: [1]

// Object form using raw()
sqlBuilder
  .update("users")
  .set({ age: raw("age + 1") })
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = age + 1 WHERE `id` = ?

// Mix raw expressions with parameterized values
sqlBuilder
  .update("users")
  .set({ age: raw("age + 1"), name: "Jane" })
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = age + 1, `name` = ? WHERE `id` = ?
// params: ['Jane', 1]

// Setting a column to NULL
sqlBuilder
  .update("users")
  .set({ name: "Jane", deleted_at: null })
  .where("id", 1)
  .build();
// UPDATE `users` SET `name` = ?, `deleted_at` = NULL WHERE `id` = ?
// params: ['Jane', 1]
```

> ⚠️ **Security Note**: Raw expressions are embedded verbatim in the SQL string. **Never pass user-supplied input to `raw()`.**

**Safety Note**: UPDATE queries require a WHERE clause to prevent accidental data loss.

### DELETE Queries

```js
const { sql, params } = sqlBuilder
  .delete("users")
  .where("status", "inactive")
  .where("last_login", "<", "2020-01-01")
  .build();
// DELETE FROM `users` WHERE `status` = ? AND `last_login` < ?
// params: ['inactive', '2020-01-01']
```

**Safety Note**: DELETE queries require a WHERE clause to prevent accidental data loss.

### UPSERT Queries

UPSERT inserts a row if it does not exist, or updates it if a duplicate key is found (`INSERT ... ON DUPLICATE KEY UPDATE`).

#### Update All Inserted Columns on Conflict

```js
const { sql, params } = sqlBuilder
  .upsert("users", {
    name: "John Doe",
    email: "john@example.com",
    age: 25
  })
  .build();
// INSERT INTO `users` (`name`, `email`, `age`) VALUES (?, ?, ?)
// ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `email` = VALUES(`email`), `age` = VALUES(`age`)
// params: ['John Doe', 'john@example.com', 25]
```

#### Update Only Specific Columns on Conflict

Pass an array of column names as the third argument to update only those columns using `VALUES(col)`:

```js
const { sql, params } = sqlBuilder
  .upsert(
    "users",
    { name: "John Doe", email: "john@example.com", age: 25 },
    ["name", "age"]
  )
  .build();
// INSERT INTO `users` (`name`, `email`, `age`) VALUES (?, ?, ?)
// ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `age` = VALUES(`age`)
// params: ['John Doe', 'john@example.com', 25]
```

#### Explicit Update Values on Conflict

Pass an object as the third argument to specify explicit update values. Supports `raw()` expressions:

```js
const { sql, params } = sqlBuilder
  .upsert(
    "users",
    { name: "John Doe", email: "john@example.com", views: 1 },
    { name: "John Doe", views: raw("views + 1") }
  )
  .build();
// INSERT INTO `users` (`name`, `email`, `views`) VALUES (?, ?, ?)
// ON DUPLICATE KEY UPDATE `name` = ?, `views` = views + 1
// params: ['John Doe', 'john@example.com', 1, 'John Doe']
```

> ⚠️ **Security Note**: Raw expressions in update data are embedded verbatim in the SQL. Never pass user-supplied input to `raw()`.

> **MySQL Compatibility Note**: The `VALUES(col)` syntax (used when `updateData` is omitted or an array) is deprecated in MySQL 8.0.20 and removed in MySQL 9.0. For MySQL 8.0.20+ or 9.0+, pass an explicit object as `updateData` instead.

## Advanced Features

### WHERE Conditions

#### Basic WHERE with Operators

```js
// Equal (default operator)
sqlBuilder.where("name", "John");
// WHERE `name` = ?

// Greater than
sqlBuilder.where("age", ">", 18);
// WHERE `age` > ?

// Less than or equal
sqlBuilder.where("score", "<=", 100);
// WHERE `score` <= ?

// Not equal
sqlBuilder.where("status", "!=", "deleted");
// WHERE `status` != ?
```

#### OR WHERE Conditions

```js
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .where("status", "active")
  .orWhere("status", "pending")
  .build();
// SELECT * FROM `users` WHERE `status` = ? OR `status` = ?
// params: ['active', 'pending']
```

#### WHERE IN / NOT IN

```js
// WHERE IN
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .whereIn("role", ["admin", "moderator", "user"])
  .build();
// SELECT * FROM `users` WHERE `role` IN (?, ?, ?)
// params: ['admin', 'moderator', 'user']

// WHERE NOT IN
const result = sqlBuilder
  .select("*")
  .from("users")
  .whereNotIn("status", ["banned", "deleted"])
  .build();
// SELECT * FROM `users` WHERE `status` NOT IN (?, ?)
// params: ['banned', 'deleted']
```

#### WHERE LIKE

```js
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .whereLike("name", "John")
  .build();
// SELECT * FROM `users` WHERE `name` LIKE ?
// params: ['%John%']
```

#### WHERE BETWEEN

```js
const { sql, params } = sqlBuilder
  .select("*")
  .from("orders")
  .whereBetween("created_at", "2024-01-01", "2024-12-31")
  .build();
// SELECT * FROM `orders` WHERE `created_at` BETWEEN ? AND ?
// params: ['2024-01-01', '2024-12-31']
```

#### WHERE NULL / NOT NULL

```js
// IS NULL
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .whereNull("deleted_at")
  .build();
// SELECT * FROM `users` WHERE `deleted_at` IS NULL

// IS NOT NULL
const result = sqlBuilder
  .select("*")
  .from("users")
  .whereNotNull("email")
  .build();
// SELECT * FROM `users` WHERE `email` IS NOT NULL
```

### JOIN Operations

#### INNER JOIN

```js
const { sql, params } = sqlBuilder
  .select(["u.id", "u.name", "p.title"])
  .from("users u")
  .join("posts p", "u.id", "=", "p.user_id")
  .build();
// SELECT `u`.`id`, `u`.`name`, `p`.`title` 
// FROM `users` `u` 
// INNER JOIN `posts` `p` ON `u`.`id` = `p`.`user_id`
```

#### LEFT JOIN

```js
const { sql, params } = sqlBuilder
  .select(["u.id", "u.name", "pr.bio"])
  .from("users u")
  .leftJoin("profiles pr", "u.id", "=", "pr.user_id")
  .where("u.status", "active")
  .build();
// SELECT `u`.`id`, `u`.`name`, `pr`.`bio` 
// FROM `users` `u` 
// LEFT JOIN `profiles` `pr` ON `u`.`id` = `pr`.`user_id` 
// WHERE `u`.`status` = ?
```

#### Complex ON Conditions

Use a callback to build multi-condition `ON` clauses with `AND` / `OR`:

```js
// Multiple AND conditions
const { sql, params } = sqlBuilder
  .select(["u.id", "u.name", "p.title"])
  .from("users u")
  .join("posts p", (on) =>
    on
      .on("u.id", "=", "p.user_id")
      .on("u.status", "=", "p.status")
  )
  .build();
// SELECT `u`.`id`, `u`.`name`, `p`.`title`
// FROM `users` `u`
// INNER JOIN `posts` `p` ON `u`.`id` = `p`.`user_id` AND `u`.`status` = `p`.`status`

// AND + OR conditions
const { sql: sql2 } = sqlBuilder
  .select("*")
  .from("users u")
  .leftJoin("posts p", (on) =>
    on
      .on("u.id", "=", "p.user_id")
      .orOn("u.uuid", "=", "p.user_uuid")
  )
  .build();
// SELECT *
// FROM `users` `u`
// LEFT JOIN `posts` `p` ON `u`.`id` = `p`.`user_id` OR `u`.`uuid` = `p`.`user_uuid`
```

#### Multiple JOINs

```js
const { sql, params } = sqlBuilder
  .select(["u.name", "p.title", "c.content"])
  .from("users u")
  .join("posts p", "u.id", "=", "p.user_id")
  .leftJoin("comments c", "p.id", "=", "c.post_id")
  .where("u.status", "active")
  .build();
// SELECT `u`.`name`, `p`.`title`, `c`.`content` 
// FROM `users` `u` 
// INNER JOIN `posts` `p` ON `u`.`id` = `p`.`user_id` 
// LEFT JOIN `comments` `c` ON `p`.`id` = `c`.`post_id` 
// WHERE `u`.`status` = ?
```

### Sorting and Grouping

#### ORDER BY

```js
// Single column sorting
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .orderBy("created_at", "DESC")
  .build();
// SELECT * FROM `users` ORDER BY `created_at` DESC

// Multiple columns sorting
const result = sqlBuilder
  .select("*")
  .from("users")
  .orderBy("status", "ASC")
  .orderBy("created_at", "DESC")
  .build();
// SELECT * FROM `users` ORDER BY `status` ASC, `created_at` DESC
```

#### GROUP BY

```js
const { sql, params } = sqlBuilder
  .select(["category", "COUNT(*) AS total"])
  .from("products")
  .groupBy("category")
  .build();
// SELECT `category`, COUNT(*) AS `total` FROM `products` GROUP BY `category`

// Multiple columns grouping
const result = sqlBuilder
  .select(["category", "status", "COUNT(*) AS count"])
  .from("products")
  .groupBy(["category", "status"])
  .build();
// SELECT `category`, `status`, COUNT(*) AS `count` 
// FROM `products` 
// GROUP BY `category`, `status`
```

#### HAVING

```js
// Single HAVING condition
const { sql, params } = sqlBuilder
  .select(["category", "COUNT(*) AS total"])
  .from("orders")
  .groupBy("category")
  .having("COUNT(*)", ">", 5)
  .build();
// SELECT `category`, COUNT(*) AS `total` FROM `orders` GROUP BY `category` HAVING COUNT(*) > ?

// Multiple AND conditions
const result = sqlBuilder
  .select("*")
  .from("orders")
  .groupBy("status")
  .having("COUNT(*)", ">", 1)
  .having("SUM(amount)", ">=", 1000)
  .build();
// HAVING COUNT(*) > ? AND SUM(amount) >= ?

// OR conditions
const result2 = sqlBuilder
  .select("*")
  .from("orders")
  .groupBy("status")
  .having("COUNT(*)", ">", 10)
  .orHaving("SUM(amount)", ">=", 5000)
  .build();
// HAVING COUNT(*) > ? OR SUM(amount) >= ?

// Raw HAVING
const result3 = sqlBuilder
  .select("*")
  .from("orders")
  .groupBy("category")
  .havingRaw("COUNT(*) > 5")
  .orHavingRaw("SUM(amount) > ?", [1000])
  .build();
// HAVING COUNT(*) > 5 OR SUM(amount) > ?
```

### Pagination

#### LIMIT and OFFSET

```js
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .limit(10)
  .offset(20)
  .build();
// SELECT * FROM `users` LIMIT 10 OFFSET 20
```

#### Page-based Pagination

```js
const page = 2;
const pageSize = 10;

const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .build();
// SELECT * FROM `users` LIMIT 10 OFFSET 10
```

### Pagination with Total Count

Get paginated results along with the total count in a single query using window functions:

```js
const page = 1;
const pageSize = 10;

const { sql, params } = sqlBuilder
  .select(["id", "name", "email"])
  .from("users")
  .where("status", "active")
  .withTotal("total_count")  // Add total count column
  .orderBy("created_at", "DESC")
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .build();
// SELECT `id`, `name`, `email`, COUNT(*) OVER() AS total_count 
// FROM `users` 
// WHERE `status` = ? 
// ORDER BY `created_at` DESC 
// LIMIT 10 OFFSET 0

// Each result row will include a 'total_count' field with the total number of records
// This allows you to calculate total pages without a separate COUNT query
```

**Benefits of withTotal():**
- **Single Query**: Get both data and total count in one database round-trip
- **Performance**: More efficient than running separate SELECT and COUNT queries
- **Consistency**: Ensures the count matches the filtered dataset
- **Custom Field Name**: Specify your own field name for the total count

```js
// Disable total count
sqlBuilder.withTotal(false);

// Use default field name (__total_count)
sqlBuilder.withTotal();

// Use custom field name
sqlBuilder.withTotal("total_rows");
```

### Raw SQL Expressions

Use the `raw()` helper to embed a SQL fragment verbatim in an `UPDATE` `SET` clause when you need column-referencing expressions (e.g. `age = age + 1`) that cannot be expressed with parameterized values.

```js
import { SQLBuilder, raw } from "sql-builder.js";

// Shorthand: set(column, raw())
sqlBuilder.update("users").set("views", raw("views + 1")).where("id", 1).build();
// UPDATE `users` SET `views` = views + 1 WHERE `id` = ?

// Object form
sqlBuilder.update("users").set({ score: raw("score * 2") }).where("id", 1).build();
// UPDATE `users` SET `score` = score * 2 WHERE `id` = ?

// Mixed: raw and parameterized values together
sqlBuilder
  .update("users")
  .set({ age: raw("age + 1"), name: "Jane" })
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = age + 1, `name` = ? WHERE `id` = ?
// params: ['Jane', 1]
```

> ⚠️ **Security Note**: `raw()` expressions are **not** parameterized and are embedded directly in the SQL string. Never pass user-supplied input to `raw()`.

### Row-Level Locking

Add `FOR UPDATE` or `FOR SHARE` to a `SELECT` query to lock the selected rows:

```js
// Lock rows for update (exclusive lock)
sqlBuilder.select("*").from("users").where("id", 1).lock("FOR UPDATE").build();
// SELECT * FROM `users` WHERE `id` = ? FOR UPDATE

// Shared lock
sqlBuilder.select("*").from("users").where("id", 1).lock("FOR SHARE").build();
// SELECT * FROM `users` WHERE `id` = ? FOR SHARE

// MySQL-compatible shared lock syntax
sqlBuilder.select("*").from("users").where("id", 1).lock("LOCK IN SHARE MODE").build();
// SELECT * FROM `users` WHERE `id` = ? LOCK IN SHARE MODE
```

### Transactions

Use the `Transaction` class to wrap multiple queries in a database transaction:

```js
import { Transaction, SQLBuilder } from "sql-builder.js";

const { sql, params } = new Transaction()
  .add(new SQLBuilder().insert("users", { name: "John", email: "john@example.com" }))
  .add(new SQLBuilder().update("accounts").set({ balance: 500 }).where("user_id", 1))
  .build();

console.log(sql);
// BEGIN;
// INSERT INTO `users` (`name`, `email`) VALUES (?, ?);
// UPDATE `accounts` SET `balance` = ? WHERE `user_id` = ?;
// COMMIT;

console.log(params); // ["John", "john@example.com", 500, 1]
```

#### Transaction Isolation Levels

Pass an optional type to `new Transaction()` to control the `BEGIN` statement:

```js
new Transaction("DEFERRED").add(...).build();  // BEGIN DEFERRED;
new Transaction("IMMEDIATE").add(...).build(); // BEGIN IMMEDIATE;
new Transaction("EXCLUSIVE").add(...).build(); // BEGIN EXCLUSIVE;
```

#### Using SAVEPOINTs

```js
const { sql, params } = new Transaction()
  .add(new SQLBuilder().insert("orders", { user_id: 1, total: 99.99 }))
  .savepoint("before_inventory")
  .add(new SQLBuilder().update("inventory").set({ stock: 10 }).where("product_id", 5))
  .releaseSavepoint("before_inventory")
  .build();

// Use rollbackTo() to undo to a savepoint instead of releasing it:
// transaction.rollbackTo("before_inventory");
```

## Security Features

### Built-in SQL Injection Protection

The library provides comprehensive protection against SQL injection:

1. **Parameterized Queries**: All values are passed as parameters, never concatenated into SQL
2. **Identifier Validation**: Table and column names are validated against a strict pattern
3. **Operator Whitelisting**: Only safe operators are allowed
4. **Automatic Escaping**: Identifiers are automatically escaped with backticks

```js
// ✅ Safe - Values are parameterized
sqlBuilder.where("username", userInput);

// ✅ Safe - Identifiers are validated and escaped
sqlBuilder.select(["id", "name"]).from("users");

// ❌ Throws Error - Invalid identifier
sqlBuilder.select("id; DROP TABLE users--").from("users");
```

### Identifier Whitelisting

For extra security, you can restrict which table and column names are allowed:

```js
// Define allowed identifiers
sqlBuilder.setAllowedIdentifiers([
  "users",
  "posts",
  "comments",
  "id",
  "name",
  "email",
  "user_id",
  "post_id",
  "status"
]);

// ✅ This works - 'users' and 'name' are in the whitelist
const { sql } = sqlBuilder
  .select("name")
  .from("users")
  .build();

// ❌ This throws an error - 'password' is not in the whitelist
sqlBuilder.select("password").from("users");
// Error: Identifier not in whitelist: password
```

### Safe Operators

Only these operators are allowed to prevent SQL injection:
- Comparison: `=`, `!=`, `<>`, `<`, `>`, `<=`, `>=`
- Pattern: `LIKE`
- Set: `IN`, `NOT IN`
- Null: `IS`, `IS NOT`
- Range: `BETWEEN`

```js
// ❌ This throws an error - invalid operator
sqlBuilder.where("id", "'; DROP TABLE users--", 1);
// Error: Unsupported or dangerous operator: '; DROP TABLE users--
```

## API Reference

### Constructor

#### `new SQLBuilder()`

Creates a new SQLBuilder instance.

```js
const sqlBuilder = new SQLBuilder();
```

### Query Type Methods

#### `select(columns)`

Sets the query type to SELECT and specifies columns to retrieve.

- **Parameters:**
  - `columns` (string | string[]): Column names to select. Use `"*"` for all columns.
- **Returns:** `SQLBuilder` (chainable)

#### `insert(table, data)`

Creates an INSERT query.

- **Parameters:**
  - `table` (string): Table name
  - `data` (object): Object with column names as keys and values to insert
- **Returns:** `SQLBuilder` (chainable)

#### `update(table)`

Creates an UPDATE query, setting the target table. **Must be followed by `.set()`. Requires a WHERE clause.**

- **Parameters:**
  - `table` (string): Table name
- **Returns:** `SQLBuilder` (chainable)

#### `set(data)`

Sets the columns and values for an UPDATE query.

- **Parameters:**
  - `data` (object): Object with column names as keys and new values. Values may be plain values (parameterized) or `RawExpression` instances (embedded verbatim).
- **Returns:** `SQLBuilder` (chainable)

#### `set(column, value)`

Shorthand for updating a single column.

- **Parameters:**
  - `column` (string): Column name to update
  - `value` (any | RawExpression): The value to set. Use `raw()` to embed a verbatim SQL expression (e.g. `raw("age + 1")`). Pass `null` to generate a literal `NULL`.
- **Returns:** `SQLBuilder` (chainable)

#### `raw(expression)`

Creates a `RawExpression` that can be used as a value in `set()`. The expression is embedded verbatim in the `SET` clause — it is **not** parameterized.

- **Parameters:**
  - `expression` (string): A non-empty SQL expression. **Do not pass user input.**
- **Returns:** `RawExpression`

```js
import { raw } from "sql-builder.js";

sqlBuilder.update("users").set({ age: raw("age + 1") }).where("id", 1).build();
// UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
```

#### `delete([table])`

Creates a DELETE query. **Requires a WHERE clause.**

- **Parameters:**
  - `table` (string, optional): Table name
- **Returns:** `SQLBuilder` (chainable)

#### `upsert(table, insertData, [updateData])`

Creates an UPSERT query (`INSERT ... ON DUPLICATE KEY UPDATE`).

- **Parameters:**
  - `table` (string): Table name
  - `insertData` (object): Object with column names as keys and values to insert
  - `updateData` (string[] | object, optional): Columns to update on conflict.  
    - If a **string array**, those columns are updated using `VALUES(col)` to reference the inserted value.  
    - If an **object**, the specified values are used (supports `RawExpression` via `raw()`).  
    - If **omitted**, all inserted columns are updated using `VALUES(col)`.
- **Returns:** `SQLBuilder` (chainable)
- **Throws:** Error if `insertData` is empty, or `updateData` is an empty array/object

### Table and Join Methods

#### `from(table)`

Specifies the table for the query.

- **Parameters:**
  - `table` (string): Table name, optionally with alias (e.g., `"users u"` or `"users AS u"`)
- **Returns:** `SQLBuilder` (chainable)

#### `join(table, first, operator, second)`

Adds an INNER JOIN clause (simple form).

- **Parameters:**
  - `table` (string): Table to join, optionally with alias
  - `first` (string): First column in join condition
  - `operator` (string): Comparison operator
  - `second` (string): Second column in join condition
- **Returns:** `SQLBuilder` (chainable)

#### `join(table, callback)`

Adds an INNER JOIN clause with complex, multi-condition `ON` clause.

- **Parameters:**
  - `table` (string): Table to join, optionally with alias
  - `callback` (function): Receives a `JoinClause` instance; call `.on()` / `.orOn()` to add conditions
- **Returns:** `SQLBuilder` (chainable)

#### `leftJoin(table, first, operator, second)`

Adds a LEFT JOIN clause.

- **Parameters:** Same as simple `join()`
- **Returns:** `SQLBuilder` (chainable)

#### `leftJoin(table, callback)`

Adds a LEFT JOIN clause with complex, multi-condition `ON` clause.

- **Parameters:** Same as callback `join()`
- **Returns:** `SQLBuilder` (chainable)

#### `rightJoin(table, first, operator, second)`

Adds a RIGHT JOIN clause.

- **Parameters:** Same as simple `join()`
- **Returns:** `SQLBuilder` (chainable)

#### `rightJoin(table, callback)`

Adds a RIGHT JOIN clause with complex, multi-condition `ON` clause.

- **Parameters:** Same as callback `join()`
- **Returns:** `SQLBuilder` (chainable)

#### `fullJoin(table, first, operator, second)`

Adds a FULL OUTER JOIN clause.

- **Parameters:** Same as simple `join()`
- **Returns:** `SQLBuilder` (chainable)

#### `fullJoin(table, callback)`

Adds a FULL OUTER JOIN clause with complex, multi-condition `ON` clause.

- **Parameters:** Same as callback `join()`
- **Returns:** `SQLBuilder` (chainable)

#### `crossJoin(table)`

Adds a CROSS JOIN clause (no ON condition).

- **Parameters:**
  - `table` (string): Table to join, optionally with alias
- **Returns:** `SQLBuilder` (chainable)

### JoinClause Methods

The `JoinClause` object is passed to the callback in `join()`, `leftJoin()`, `rightJoin()`, and `fullJoin()`. All identifiers and operators are validated automatically.

#### `on(first, operator, second)`

Appends an AND ON condition.

- **Parameters:**
  - `first` (string): First column (e.g. `"u.id"`)
  - `operator` (string): Comparison operator (e.g. `"="`)
  - `second` (string): Second column (e.g. `"p.user_id"`)
- **Returns:** `JoinClause` (chainable)

#### `orOn(first, operator, second)`

Appends an OR ON condition.

- **Parameters:** Same as `on()`
- **Returns:** `JoinClause` (chainable)

### WHERE Condition Methods

#### `where(column, [operator], value)`

Adds a WHERE condition with AND.

- **Parameters:**
  - `column` (string): Column name
  - `operator` (string, optional): Comparison operator (default: `"="`)
  - `value` (any): Value to compare
- **Returns:** `SQLBuilder` (chainable)

#### `orWhere(column, [operator], value)`

Adds a WHERE condition with OR.

- **Parameters:** Same as `where()`
- **Returns:** `SQLBuilder` (chainable)

#### `whereIn(column, values)`

Adds a WHERE IN condition.

- **Parameters:**
  - `column` (string): Column name
  - `values` (array): Array of values
- **Returns:** `SQLBuilder` (chainable)

#### `whereNotIn(column, values)`

Adds a WHERE NOT IN condition.

- **Parameters:** Same as `whereIn()`
- **Returns:** `SQLBuilder` (chainable)

#### `whereLike(column, value)`

Adds a WHERE LIKE condition. The value is automatically wrapped with `%` wildcards for a contains-style search.

- **Parameters:**
  - `column` (string): Column name
  - `value` (string): Search value
- **Returns:** `SQLBuilder` (chainable)

#### `whereBetween(column, start, end)`

Adds a WHERE BETWEEN condition.

- **Parameters:**
  - `column` (string): Column name
  - `start` (any): Start value
  - `end` (any): End value
- **Returns:** `SQLBuilder` (chainable)

#### `whereNull(column)`

Adds a WHERE IS NULL condition.

- **Parameters:**
  - `column` (string): Column name
- **Returns:** `SQLBuilder` (chainable)

#### `whereNotNull(column)`

Adds a WHERE IS NOT NULL condition.

- **Parameters:**
  - `column` (string): Column name
- **Returns:** `SQLBuilder` (chainable)

### Sorting and Grouping Methods

#### `orderBy(column, [direction])`

Adds an ORDER BY clause.

- **Parameters:**
  - `column` (string): Column name
  - `direction` (string, optional): Sort direction - `"ASC"` or `"DESC"` (default: `"ASC"`)
- **Returns:** `SQLBuilder` (chainable)

#### `groupBy(columns)`

Adds a GROUP BY clause.

- **Parameters:**
  - `columns` (string | string[]): Column name(s) to group by
- **Returns:** `SQLBuilder` (chainable)

#### `having(column, operator, value)`

Adds a HAVING condition with AND.

- **Parameters:**
  - `column` (string): Column name or aggregate expression (e.g. `'COUNT(*)'`)
  - `operator` (string): Comparison operator
  - `value` (any): Value to compare
- **Returns:** `SQLBuilder` (chainable)

#### `orHaving(column, operator, value)`

Adds a HAVING condition with OR.

- **Parameters:** Same as `having()`
- **Returns:** `SQLBuilder` (chainable)

#### `havingRaw(expression, [params])`

Adds a raw HAVING condition with AND.

- **Parameters:**
  - `expression` (string): Raw SQL expression
  - `params` (array, optional): Parameter values for placeholders
- **Returns:** `SQLBuilder` (chainable)

#### `orHavingRaw(expression, [params])`

Adds a raw HAVING condition with OR.

- **Parameters:** Same as `havingRaw()`
- **Returns:** `SQLBuilder` (chainable)

### Pagination Methods

#### `limit(number)`

Sets the maximum number of rows to return.

- **Parameters:**
  - `number` (number): Maximum number of rows (must be positive integer)
- **Returns:** `SQLBuilder` (chainable)

#### `offset(number)`

Sets the number of rows to skip.

- **Parameters:**
  - `number` (number): Number of rows to skip (must be non-negative integer)
- **Returns:** `SQLBuilder` (chainable)

#### `withTotal([fieldNameOrEnabled])`

Adds a total count column using window functions for pagination.

- **Parameters:**
  - `fieldNameOrEnabled` (string | boolean, optional): Field name for total count or `false` to disable (default: `"__total_count"`)
- **Returns:** `SQLBuilder` (chainable)

#### `lock(mode)`

Appends a row-level locking clause to a `SELECT` query.

- **Parameters:**
  - `mode` (`"FOR UPDATE"` | `"FOR SHARE"` | `"LOCK IN SHARE MODE"`): Locking mode
- **Returns:** `SQLBuilder` (chainable)

### Utility Methods

#### `build()`

Builds and returns the final SQL query as a `BuildResult` object.

- **Returns:** `BuildResult` — object with:
  - `sql: string` — SQL string with `?` placeholders
  - `params: any[]` — parameter array
  - `toString(): string` — returns the complete SQL with parameters safely inlined (for debugging only, not for execution)
- **Throws:** Error if table name is missing or query is invalid

#### `reset()`

Resets the builder to its initial state.

- **Returns:** `SQLBuilder` (chainable)

#### `setAllowedIdentifiers(identifiers)`

Sets a whitelist of allowed table and column names for enhanced security.

- **Parameters:**
  - `identifiers` (string[]): Array of allowed identifier names
- **Returns:** `SQLBuilder` (chainable)

#### `toString()`

Returns a formatted SQL string with parameters safely substituted (for debugging only, not for execution). This is equivalent to calling `build().toString()`.

- **Returns:** `string` - Formatted SQL string with parameters inlined

#### `getParams()`

Returns a copy of the current parameter array.

- **Returns:** `any[]` - Array of query parameters

#### `getQueryType()`

Returns the current query type.

- **Returns:** `string` - Query type (`"SELECT"`, `"INSERT"`, `"UPSERT"`, `"UPDATE"`, or `"DELETE"`)

### Transaction Class

#### `new Transaction([type])`

Creates a new Transaction instance.

- **Parameters:**
  - `type` (`"DEFERRED"` | `"IMMEDIATE"` | `"EXCLUSIVE"`, optional): Controls the `BEGIN` statement. Defaults to plain `BEGIN`.

#### `add(builder)`

Adds a `SQLBuilder` query to the transaction.

- **Parameters:**
  - `builder` (required): A `SQLBuilder` instance
- **Returns:** `Transaction` instance for chaining
- **Throws:** Error if `builder` is not a `SQLBuilder` instance

#### `savepoint(name)`

Adds a `SAVEPOINT` statement to the transaction.

- **Parameters:**
  - `name` (required): Savepoint name (letters, digits, and underscores only; must start with a letter or underscore)
- **Returns:** `Transaction` instance for chaining

#### `releaseSavepoint(name)`

Adds a `RELEASE SAVEPOINT` statement to the transaction.

- **Parameters:**
  - `name` (required): Savepoint name
- **Returns:** `Transaction` instance for chaining

#### `rollbackTo(name)`

Adds a `ROLLBACK TO SAVEPOINT` statement to the transaction.

- **Parameters:**
  - `name` (required): Savepoint name
- **Returns:** `Transaction` instance for chaining

#### `build()` (Transaction)

Builds the complete transaction SQL.

- **Returns:** `BuildResult` — object with:
  - `sql: string` — full transaction SQL (wrapped in `BEGIN`/`COMMIT`) with `?` placeholders
  - `params: any[]` — all merged parameters in order
  - `toString(): string` — returns the complete transaction SQL with parameters safely inlined (for debugging only)

## Best Practices

### 1. Always Use Parameterized Values

✅ **DO:**
```js
sqlBuilder.where("username", userInput);
```

❌ **DON'T:**
```js
// Never concatenate user input into SQL
const sql = `SELECT * FROM users WHERE username = '${userInput}'`;
```

### 2. Use WHERE Clauses with UPDATE and DELETE

The library requires WHERE clauses for UPDATE and DELETE to prevent accidental data loss:

```js
// ❌ This will throw an error
sqlBuilder.update("users").set({ status: "inactive" }).build();
// Error: UPDATE query requires WHERE clause

// ✅ This is safe
sqlBuilder.update("users").set({ status: "inactive" })
  .where("last_login", "<", "2020-01-01")
  .build();
```

### 3. Reuse the SQLBuilder Instance

You can reset and reuse the same instance:

```js
const sqlBuilder = new SQLBuilder();

// First query
const query1 = sqlBuilder.select("*").from("users").build();

// Reset and build second query
const query2 = sqlBuilder.reset().select("*").from("posts").build();
```

### 4. Use Identifier Whitelisting for User-Controlled Columns

If users can specify which columns to query, use a whitelist:

```js
sqlBuilder.setAllowedIdentifiers(["id", "name", "email", "created_at"]);

// Now only these columns can be used
const userSelectedColumns = ["email", "created_at"]; // from user input
const { sql } = sqlBuilder
  .select(userSelectedColumns)
  .from("users")
  .build();
```

### 5. Use withTotal() for Efficient Pagination

Instead of two queries:

```js
// ❌ Less efficient - two database queries
const countQuery = sqlBuilder.select("COUNT(*) AS total").from("users").build();
const dataQuery = sqlBuilder.reset().select("*").from("users").limit(10).build();
```

Use a single query with `withTotal()`:

```js
// ✅ More efficient - one database query
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .withTotal()
  .limit(10)
  .build();
```

### 6. Execute with Your Database Driver

The library builds SQL and parameters - you execute them with your database driver:

```js
import mysql from "mysql2/promise";
import { SQLBuilder } from "sql-builder.js";

const connection = await mysql.createConnection({ /* config */ });
const sqlBuilder = new SQLBuilder();

const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .where("status", "active")
  .build();

const [rows] = await connection.execute(sql, params);
```

## Performance

The library is optimized for high performance with:

- **Cached Regex Patterns**: Compiled once and reused
- **Efficient String Building**: Minimal memory allocations
- **No Dependencies**: Zero overhead from external packages

See [PERFORMANCE.md](PERFORMANCE.md) for detailed benchmarks.

## TypeScript Support

The library includes TypeScript type definitions:

```typescript
import { SQLBuilder, Transaction, RawExpression, raw } from "sql-builder.js";

const sqlBuilder = new SQLBuilder();

const result: { sql: string; params: any[] } = sqlBuilder
  .select(["id", "name"])
  .from("users")
  .where("status", "active")
  .build();

// raw() is fully typed
const update = sqlBuilder
  .update("users")
  .set({ age: raw("age + 1"), name: "Jane" })
  .where("id", 1)
  .build();
```

## License

The [Anti 996 License](LICENSE)
