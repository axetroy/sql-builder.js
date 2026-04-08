# sql-builder.js

[![Badge](https://img.shields.io/badge/link-996.icu-%23FF4D5B.svg?style=flat-square)](https://996.icu/#/zh_CN)
[![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg?style=flat-square)](https://github.com/996icu/996.ICU/blob/master/LICENSE)
![Node](https://img.shields.io/badge/node-%3E=14-blue.svg?style=flat-square)
[![npm version](https://badge.fury.io/js/sql-builder.js.svg)](https://badge.fury.io/js/sql-builder.js)

一个轻量、灵活的 JavaScript/TypeScript SQL 查询构建器，**内置 SQL 注入防护**。

[English](./README.md) | 中文

## 特性

✨ **安全设计**：内置 SQL 注入防护，支持参数化查询和标识符验证  
🎯 **类型安全**：完整的 TypeScript 支持与类型定义  
🚀 **零依赖**：轻量级，无任何外部依赖  
⚡ **高性能**：通过缓存正则表达式和高效字符串构建进行了性能优化  
🔧 **灵活 API**：流式链式调用接口，支持构建复杂查询  
📦 **双模块支持**：同时支持 ESM 和 CommonJS  
🛡️ **安全优先**：运算符白名单和标识符验证，防止 SQL 注入

## 安装

```bash
npm install sql-builder.js --save
```

## 快速开始

```js
import { SQLBuilder } from "sql-builder.js";

// 创建一个新的 SQLBuilder 实例
const sqlBuilder = new SQLBuilder();

// 构建一个简单的 SELECT 查询
const result = sqlBuilder
  .select("*")
  .from("users")
  .where("age", ">", 18)
  .build();

console.log(result.sql);         // SELECT * FROM `users` WHERE `age` > ?
console.log(result.params);      // [18]
console.log(result.toString());  // SELECT * FROM `users` WHERE `age` > 18

// 解构方式同样有效
const { sql, params } = result;
```

## 目录

- [基本用法](#基本用法)
  - [SELECT 查询](#select-查询)
  - [INSERT 查询](#insert-查询)
  - [UPDATE 查询](#update-查询)
  - [DELETE 查询](#delete-查询)
  - [UPSERT 查询](#upsert-查询)
- [高级特性](#高级特性)
  - [WHERE 条件](#where-条件)
  - [JOIN 操作](#join-操作)
  - [排序与分组](#排序与分组)
  - [分页](#分页)
  - [带总数的分页](#带总数的分页)
  - [原始 SQL 表达式](#原始-sql-表达式)
  - [行级锁](#行级锁)
  - [事务](#事务)
- [安全特性](#安全特性)
- [API 参考](#api-参考)
- [最佳实践](#最佳实践)

## 基本用法

### SELECT 查询

#### 查询所有列

```js
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .build();
// SELECT * FROM `users`
```

#### 查询指定列

```js
const { sql, params } = sqlBuilder
  .select(["id", "name", "email"])
  .from("users")
  .build();
// SELECT `id`, `name`, `email` FROM `users`
```

#### 带表别名的查询

```js
const { sql, params } = sqlBuilder
  .select(["u.id", "u.name", "u.email"])
  .from("users u")
  .build();
// SELECT `u`.`id`, `u`.`name`, `u`.`email` FROM `users` `u`
```

#### 带 WHERE 子句的查询

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

### INSERT 查询

```js
const { sql, params } = sqlBuilder
  .insert("users", {
    name: "张三",
    email: "zhangsan@example.com",
    age: 25,
    status: "active"
  })
  .build();
// INSERT INTO `users` (`name`, `email`, `age`, `status`) VALUES (?, ?, ?, ?)
// params: ['张三', 'zhangsan@example.com', 25, 'active']
```

### UPDATE 查询

```js
const { sql, params } = sqlBuilder
  .update("users")
  .set({
    name: "李四",
    age: 26
  })
  .where("id", 1)
  .build();
// UPDATE `users` SET `name` = ?, `age` = ? WHERE `id` = ?
// params: ['李四', 26, 1]
```

#### UPDATE 中的原始 SQL 表达式

使用 `raw()` 可在 `SET` 子句中直接嵌入 SQL 表达式——例如，将某列相对于其当前值递增：

```js
import { SQLBuilder, raw } from "sql-builder.js";

// 简写形式：set(column, value) — 普通值
const { sql, params } = sqlBuilder
  .update("users")
  .set("age", 26)
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = ? WHERE `id` = ?
// params: [26, 1]

// 简写形式：set(column, raw()) — 原始 SQL 表达式
sqlBuilder
  .update("users")
  .set("age", raw("age + 1"))
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
// params: [1]

// 对象形式，使用 raw()
sqlBuilder
  .update("users")
  .set({ age: raw("age + 1") })
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = age + 1 WHERE `id` = ?

// 混合使用原始表达式和参数化值
sqlBuilder
  .update("users")
  .set({ age: raw("age + 1"), name: "李四" })
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = age + 1, `name` = ? WHERE `id` = ?
// params: ['李四', 1]

// 将列设置为 NULL
sqlBuilder
  .update("users")
  .set({ name: "李四", deleted_at: null })
  .where("id", 1)
  .build();
// UPDATE `users` SET `name` = ?, `deleted_at` = NULL WHERE `id` = ?
// params: ['李四', 1]
```

> ⚠️ **安全提示**：原始表达式会直接嵌入 SQL 字符串，**不会**被参数化。**请勿将用户输入传入 `raw()`。**

**安全提示**：UPDATE 查询需要 WHERE 子句，以防止意外的数据损失。

### DELETE 查询

```js
const { sql, params } = sqlBuilder
  .delete("users")
  .where("status", "inactive")
  .where("last_login", "<", "2020-01-01")
  .build();
// DELETE FROM `users` WHERE `status` = ? AND `last_login` < ?
// params: ['inactive', '2020-01-01']
```

**安全提示**：DELETE 查询需要 WHERE 子句，以防止意外的数据损失。

### UPSERT 查询

UPSERT 在记录不存在时插入，在发现重复键时更新（`INSERT ... ON DUPLICATE KEY UPDATE`）。

#### 冲突时更新所有插入列

```js
const { sql, params } = sqlBuilder
  .upsert("users", {
    name: "张三",
    email: "zhangsan@example.com",
    age: 25
  })
  .build();
// INSERT INTO `users` (`name`, `email`, `age`) VALUES (?, ?, ?)
// ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `email` = VALUES(`email`), `age` = VALUES(`age`)
// params: ['张三', 'zhangsan@example.com', 25]
```

#### 冲突时只更新指定列

将列名字符串数组作为第三个参数传入，只更新这些列（使用 `VALUES(col)`）：

```js
const { sql, params } = sqlBuilder
  .upsert(
    "users",
    { name: "张三", email: "zhangsan@example.com", age: 25 },
    ["name", "age"]
  )
  .build();
// INSERT INTO `users` (`name`, `email`, `age`) VALUES (?, ?, ?)
// ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `age` = VALUES(`age`)
// params: ['张三', 'zhangsan@example.com', 25]
```

#### 冲突时使用显式更新值

将对象作为第三个参数传入，以指定显式更新值，支持 `raw()` 表达式：

```js
const { sql, params } = sqlBuilder
  .upsert(
    "users",
    { name: "张三", email: "zhangsan@example.com", views: 1 },
    { name: "张三", views: raw("views + 1") }
  )
  .build();
// INSERT INTO `users` (`name`, `email`, `views`) VALUES (?, ?, ?)
// ON DUPLICATE KEY UPDATE `name` = ?, `views` = views + 1
// params: ['张三', 'zhangsan@example.com', 1, '张三']
```

> ⚠️ **安全提示**：更新数据中的原始表达式会直接嵌入 SQL，请勿将用户输入传入 `raw()`。

> **MySQL 兼容性说明**：使用 `VALUES(col)` 语法（省略 `updateData` 或传入数组时）在 MySQL 8.0.20+ 中已弃用，并在 MySQL 9.0 中被移除。对于 MySQL 8.0.20+ 或 9.0+，请改为传入显式对象作为 `updateData`。

## 高级特性

### WHERE 条件

#### 带运算符的基本 WHERE

```js
// 等于（默认运算符）
sqlBuilder.where("name", "张三");
// WHERE `name` = ?

// 大于
sqlBuilder.where("age", ">", 18);
// WHERE `age` > ?

// 小于等于
sqlBuilder.where("score", "<=", 100);
// WHERE `score` <= ?

// 不等于
sqlBuilder.where("status", "!=", "deleted");
// WHERE `status` != ?
```

#### OR WHERE 条件

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
// 使用通配符搜索（默认）
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .whereLike("name", "张")
  .build();
// SELECT * FROM `users` WHERE `name` LIKE ?
// params: ['%张%']

// 使用自定义模式（不自动添加通配符）
const result = sqlBuilder
  .select("*")
  .from("users")
  .whereLike("email", "%@example.com", false)
  .build();
// SELECT * FROM `users` WHERE `email` LIKE ?
// params: ['%@example.com']
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

### JOIN 操作

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

#### 多个 JOIN

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

### 排序与分组

#### ORDER BY

```js
// 单列排序
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .orderBy("created_at", "DESC")
  .build();
// SELECT * FROM `users` ORDER BY `created_at` DESC

// 多列排序
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

// 多列分组
const result = sqlBuilder
  .select(["category", "status", "COUNT(*) AS count"])
  .from("products")
  .groupBy(["category", "status"])
  .build();
// SELECT `category`, `status`, COUNT(*) AS `count` 
// FROM `products` 
// GROUP BY `category`, `status`
```

### 分页

#### LIMIT 和 OFFSET

```js
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .limit(10)
  .offset(20)
  .build();
// SELECT * FROM `users` LIMIT 10 OFFSET 20
```

#### 基于页码的分页

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

### 带总数的分页

使用窗口函数在单个查询中同时获取分页数据和总记录数：

```js
const page = 1;
const pageSize = 10;

const { sql, params } = sqlBuilder
  .select(["id", "name", "email"])
  .from("users")
  .where("status", "active")
  .withTotal("total_count")  // 添加总数列
  .orderBy("created_at", "DESC")
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .build();
// SELECT `id`, `name`, `email`, COUNT(*) OVER() AS total_count 
// FROM `users` 
// WHERE `status` = ? 
// ORDER BY `created_at` DESC 
// LIMIT 10 OFFSET 0

// 每行结果都会包含 'total_count' 字段，表示总记录数
// 这样无需额外的 COUNT 查询即可计算总页数
```

**withTotal() 的优势：**
- **单次查询**：在一次数据库请求中同时获取数据和总数
- **高性能**：比分别执行 SELECT 和 COUNT 查询更高效
- **数据一致性**：确保计数与筛选后的数据集匹配
- **自定义字段名**：可以自定义总数字段的名称

```js
// 禁用总数统计
sqlBuilder.withTotal(false);

// 使用默认字段名（__total_count）
sqlBuilder.withTotal();

// 使用自定义字段名
sqlBuilder.withTotal("total_rows");
```

### 原始 SQL 表达式

使用 `raw()` 辅助函数可在 `UPDATE` 的 `SET` 子句中直接嵌入 SQL 片段，用于需要引用列本身的表达式（如 `age = age + 1`）。

```js
import { SQLBuilder, raw } from "sql-builder.js";

// 简写形式：set(column, raw())
sqlBuilder.update("users").set("views", raw("views + 1")).where("id", 1).build();
// UPDATE `users` SET `views` = views + 1 WHERE `id` = ?

// 对象形式
sqlBuilder.update("users").set({ score: raw("score * 2") }).where("id", 1).build();
// UPDATE `users` SET `score` = score * 2 WHERE `id` = ?

// 混合使用：原始表达式与参数化值共存
sqlBuilder
  .update("users")
  .set({ age: raw("age + 1"), name: "李四" })
  .where("id", 1)
  .build();
// UPDATE `users` SET `age` = age + 1, `name` = ? WHERE `id` = ?
// params: ['李四', 1]
```

> ⚠️ **安全提示**：`raw()` 表达式**不会**被参数化，会直接嵌入 SQL 字符串。请勿将用户输入传入 `raw()`。

### 行级锁

在 `SELECT` 查询中添加 `FOR UPDATE` 或 `FOR SHARE` 以锁定所选行：

```js
// 排他锁（FOR UPDATE）
sqlBuilder.select("*").from("users").where("id", 1).lock("FOR UPDATE").build();
// SELECT * FROM `users` WHERE `id` = ? FOR UPDATE

// 共享锁
sqlBuilder.select("*").from("users").where("id", 1).lock("FOR SHARE").build();
// SELECT * FROM `users` WHERE `id` = ? FOR SHARE

// MySQL 兼容的共享锁语法
sqlBuilder.select("*").from("users").where("id", 1).lock("LOCK IN SHARE MODE").build();
// SELECT * FROM `users` WHERE `id` = ? LOCK IN SHARE MODE
```

### 事务

使用 `Transaction` 类将多个查询包装在数据库事务中：

```js
import { Transaction, SQLBuilder } from "sql-builder.js";

const { sql, params } = new Transaction()
  .add(new SQLBuilder().insert("users", { name: "张三", email: "zhang@example.com" }))
  .add(new SQLBuilder().update("accounts", { balance: 500 }).where("user_id", 1))
  .build();

console.log(sql);
// BEGIN;
// INSERT INTO `users` (`name`, `email`) VALUES (?, ?);
// UPDATE `accounts` SET `balance` = ? WHERE `user_id` = ?;
// COMMIT;

console.log(params); // ["张三", "zhang@example.com", 500, 1]
```

#### 事务隔离级别

向 `new Transaction()` 传入可选类型以控制 `BEGIN` 语句：

```js
new Transaction("DEFERRED").add(...).build();  // BEGIN DEFERRED;
new Transaction("IMMEDIATE").add(...).build(); // BEGIN IMMEDIATE;
new Transaction("EXCLUSIVE").add(...).build(); // BEGIN EXCLUSIVE;
```

#### 使用 SAVEPOINT

```js
const { sql, params } = new Transaction()
  .add(new SQLBuilder().insert("orders", { user_id: 1, total: 99.99 }))
  .savepoint("before_inventory")
  .add(new SQLBuilder().update("inventory", { stock: 10 }).where("product_id", 5))
  .releaseSavepoint("before_inventory")
  .build();

// 使用 rollbackTo() 回滚到保存点而不是释放它：
// transaction.rollbackTo("before_inventory");
```

## 安全特性

### 内置 SQL 注入防护

该库提供了全面的 SQL 注入防护：

1. **参数化查询**：所有值以参数形式传递，不会被拼接到 SQL 中
2. **标识符验证**：表名和列名经过严格模式验证
3. **运算符白名单**：只允许安全的运算符
4. **自动转义**：标识符自动使用反引号进行转义

```js
// ✅ 安全 - 值被参数化
sqlBuilder.where("username", userInput);

// ✅ 安全 - 标识符经过验证和转义
sqlBuilder.select(["id", "name"]).from("users");

// ❌ 抛出错误 - 无效标识符
sqlBuilder.select("id; DROP TABLE users--").from("users");
```

### 标识符白名单

为了增强安全性，可以限制允许使用的表名和列名：

```js
// 定义允许的标识符
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

// ✅ 正常工作 - 'users' 和 'name' 在白名单中
const { sql } = sqlBuilder
  .select("name")
  .from("users")
  .build();

// ❌ 抛出错误 - 'password' 不在白名单中
sqlBuilder.select("password").from("users");
// Error: Identifier not in whitelist: password
```

### 安全运算符

只允许以下运算符，以防止 SQL 注入：
- 比较运算符：`=`、`!=`、`<>`、`<`、`>`、`<=`、`>=`
- 模式匹配：`LIKE`
- 集合运算：`IN`、`NOT IN`
- 空值判断：`IS`、`IS NOT`
- 范围查询：`BETWEEN`

```js
// ❌ 抛出错误 - 无效运算符
sqlBuilder.where("id", "'; DROP TABLE users--", 1);
// Error: Unsupported or dangerous operator: '; DROP TABLE users--
```

## API 参考

### 构造函数

#### `new SQLBuilder()`

创建一个新的 SQLBuilder 实例。

```js
const sqlBuilder = new SQLBuilder();
```

### 查询类型方法

#### `select(columns)`

设置查询类型为 SELECT 并指定要检索的列。

- **参数：**
  - `columns`（string | string[]）：要查询的列名，使用 `"*"` 查询所有列
- **返回值：** `SQLBuilder`（可链式调用）

#### `insert(table, data)`

创建 INSERT 查询。

- **参数：**
  - `table`（string）：表名
  - `data`（object）：以列名为键、插入值为值的对象
- **返回值：** `SQLBuilder`（可链式调用）

#### `update(table)`

创建 UPDATE 查询。**需要 WHERE 子句。**

- **参数：**
  - `table`（string）：表名
- **返回值：** `SQLBuilder`（可链式调用）

#### `set(data)`

设置 UPDATE 查询的列和值。

- **参数：**
  - `data`（object）：以列名为键、新值为值的对象，值可以是普通值（参数化）或 `RawExpression` 实例（直接嵌入）。传入 `null` 将生成字面量 `NULL`。
- **返回值：** `SQLBuilder`（可链式调用）

#### `set(column, value)`

更新单列的简写形式。

- **参数：**
  - `column`（string）：要更新的列名
  - `value`（any | RawExpression）：列的值。使用 `raw()` 可嵌入原始 SQL 表达式（如 `raw("age + 1")`）。传入 `null` 将生成字面量 `NULL`。
- **返回值：** `SQLBuilder`（可链式调用）

#### `raw(expression)`

创建一个 `RawExpression`，可作为 `set()` 的值使用。表达式会直接嵌入 `SET` 子句——**不会**被参数化。

- **参数：**
  - `expression`（string）：非空 SQL 表达式。**请勿传入用户输入。**
- **返回值：** `RawExpression`

```js
import { raw } from "sql-builder.js";

sqlBuilder.update("users").set({ age: raw("age + 1") }).where("id", 1).build();
// UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
```

#### `delete([table])`

创建 DELETE 查询。**需要 WHERE 子句。**

- **参数：**
  - `table`（string，可选）：表名
- **返回值：** `SQLBuilder`（可链式调用）

#### `upsert(table, insertData, [updateData])`

创建 UPSERT 查询（`INSERT ... ON DUPLICATE KEY UPDATE`）。

- **参数：**
  - `table`（string）：表名
  - `insertData`（object）：要插入的数据对象，键为列名，值为插入值
  - `updateData`（string[] | object，可选）：冲突时要更新的内容。  
    - 若为**字符串数组**，则使用 `VALUES(col)` 更新指定列以引用插入值。  
    - 若为**对象**，则使用指定的值（支持通过 `raw()` 的 `RawExpression`）。  
    - 若**省略**，则使用 `VALUES(col)` 更新所有插入列。
- **返回值：** `SQLBuilder`（可链式调用）
- **抛出异常：** 当 `insertData` 为空或 `updateData` 为空数组/对象时抛出错误

### 表和 JOIN 方法

#### `from(table)`

指定查询的表。

- **参数：**
  - `table`（string）：表名，可选地带别名（如 `"users u"` 或 `"users AS u"`）
- **返回值：** `SQLBuilder`（可链式调用）

#### `join(table, first, operator, second)`

添加 INNER JOIN 子句。

- **参数：**
  - `table`（string）：要连接的表，可选地带别名
  - `first`（string）：连接条件中的第一个列
  - `operator`（string）：比较运算符
  - `second`（string）：连接条件中的第二个列
- **返回值：** `SQLBuilder`（可链式调用）

#### `leftJoin(table, first, operator, second)`

添加 LEFT JOIN 子句。

- **参数：** 与 `join()` 相同
- **返回值：** `SQLBuilder`（可链式调用）

### WHERE 条件方法

#### `where(column, [operator], value)`

添加带 AND 的 WHERE 条件。

- **参数：**
  - `column`（string）：列名
  - `operator`（string，可选）：比较运算符（默认：`"="`）
  - `value`（any）：比较的值
- **返回值：** `SQLBuilder`（可链式调用）

#### `orWhere(column, [operator], value)`

添加带 OR 的 WHERE 条件。

- **参数：** 与 `where()` 相同
- **返回值：** `SQLBuilder`（可链式调用）

#### `whereIn(column, values)`

添加 WHERE IN 条件。

- **参数：**
  - `column`（string）：列名
  - `values`（array）：值的数组
- **返回值：** `SQLBuilder`（可链式调用）

#### `whereNotIn(column, values)`

添加 WHERE NOT IN 条件。

- **参数：** 与 `whereIn()` 相同
- **返回值：** `SQLBuilder`（可链式调用）

#### `whereLike(column, value, [wildcard])`

添加 WHERE LIKE 条件。

- **参数：**
  - `column`（string）：列名
  - `value`（string）：搜索值
  - `wildcard`（boolean，可选）：自动添加 `%` 通配符（默认：`true`）
- **返回值：** `SQLBuilder`（可链式调用）

#### `whereBetween(column, start, end)`

添加 WHERE BETWEEN 条件。

- **参数：**
  - `column`（string）：列名
  - `start`（any）：起始值
  - `end`（any）：结束值
- **返回值：** `SQLBuilder`（可链式调用）

#### `whereNull(column)`

添加 WHERE IS NULL 条件。

- **参数：**
  - `column`（string）：列名
- **返回值：** `SQLBuilder`（可链式调用）

#### `whereNotNull(column)`

添加 WHERE IS NOT NULL 条件。

- **参数：**
  - `column`（string）：列名
- **返回值：** `SQLBuilder`（可链式调用）

### 排序与分组方法

#### `orderBy(column, [direction])`

添加 ORDER BY 子句。

- **参数：**
  - `column`（string）：列名
  - `direction`（string，可选）：排序方向 - `"ASC"` 或 `"DESC"`（默认：`"ASC"`）
- **返回值：** `SQLBuilder`（可链式调用）

#### `groupBy(columns)`

添加 GROUP BY 子句。

- **参数：**
  - `columns`（string | string[]）：要分组的列名
- **返回值：** `SQLBuilder`（可链式调用）

### 分页方法

#### `limit(number)`

设置返回的最大行数。

- **参数：**
  - `number`（number）：最大行数（必须为正整数）
- **返回值：** `SQLBuilder`（可链式调用）

#### `offset(number)`

设置跳过的行数。

- **参数：**
  - `number`（number）：跳过的行数（必须为非负整数）
- **返回值：** `SQLBuilder`（可链式调用）

#### `withTotal([fieldNameOrEnabled])`

使用窗口函数添加总记录数列，用于分页。

- **参数：**
  - `fieldNameOrEnabled`（string | boolean，可选）：总记录数的字段名，或 `false` 表示禁用（默认：`"__total_count"`）
- **返回值：** `SQLBuilder`（可链式调用）

#### `lock(mode)`

为 `SELECT` 查询添加行级锁子句。

- **参数：**
  - `mode`（`"FOR UPDATE"` | `"FOR SHARE"` | `"LOCK IN SHARE MODE"`）：锁定模式
- **返回值：** `SQLBuilder`（可链式调用）

### 工具方法

#### `build()`

构建并返回最终的 SQL 查询，以 `BuilderResult` 对象的形式返回。

- **返回值：** `BuilderResult` — 对象包含：
  - `sql: string` — 含 `?` 占位符的 SQL 字符串
  - `params: any[]` — 参数数组
  - `toString(): string` — 返回将参数安全内联后的完整 SQL（仅用于调试，不可用于执行）
- **抛出：** 如果缺少表名或查询无效则抛出错误

#### `reset()`

将构建器重置为初始状态。

- **返回值：** `SQLBuilder`（可链式调用）

#### `setAllowedIdentifiers(identifiers)`

设置允许的表名和列名白名单，以增强安全性。

- **参数：**
  - `identifiers`（string[]）：允许的标识符名称数组
- **返回值：** `SQLBuilder`（可链式调用）

#### `toString()`

返回将参数安全替换后的格式化 SQL 字符串（仅用于调试，不可用于执行）。等价于调用 `build().toString()`。

- **返回值：** `string` - 内联参数后的格式化 SQL 字符串

#### `getParams()`

返回当前参数数组的副本。

- **返回值：** `any[]` - 查询参数数组

#### `getQueryType()`

返回当前查询类型。

- **返回值：** `string` - 查询类型（`"SELECT"`、`"INSERT"`、`"UPSERT"`、`"UPDATE"` 或 `"DELETE"`）

### Transaction 类

#### `new Transaction([type])`

创建一个新的 Transaction 实例。

- **参数：**
  - `type`（`"DEFERRED"` | `"IMMEDIATE"` | `"EXCLUSIVE"`，可选）：控制 `BEGIN` 语句，默认为普通 `BEGIN`。

#### `add(builder)`

向事务中添加一个 `SQLBuilder` 查询。

- **参数：**
  - `builder`（必须）：`SQLBuilder` 实例
- **返回值：** `Transaction` 实例（支持链式调用）
- **抛出：** 当 `builder` 不是 `SQLBuilder` 实例时报错

#### `savepoint(name)`

向事务中添加 `SAVEPOINT` 语句。

- **参数：**
  - `name`（必须）：保存点名称（只允许字母、数字和下划线，且必须以字母或下划线开头）
- **返回值：** `Transaction` 实例（支持链式调用）

#### `releaseSavepoint(name)`

向事务中添加 `RELEASE SAVEPOINT` 语句。

- **参数：**
  - `name`（必须）：保存点名称
- **返回值：** `Transaction` 实例（支持链式调用）

#### `rollbackTo(name)`

向事务中添加 `ROLLBACK TO SAVEPOINT` 语句。

- **参数：**
  - `name`（必须）：保存点名称
- **返回值：** `Transaction` 实例（支持链式调用）

#### `build()`（Transaction）

构建完整的事务 SQL。

- **返回值：** `BuilderResult` — 对象包含：
  - `sql: string` — 完整的事务 SQL（包含 `BEGIN`/`COMMIT`）含 `?` 占位符
  - `params: any[]` — 所有合并后的参数
  - `toString(): string` — 返回将参数安全内联后的完整事务 SQL（仅用于调试）

## 最佳实践

### 1. 始终使用参数化的值

✅ **推荐：**
```js
sqlBuilder.where("username", userInput);
```

❌ **不推荐：**
```js
// 永远不要将用户输入拼接到 SQL 中
const sql = `SELECT * FROM users WHERE username = '${userInput}'`;
```

### 2. UPDATE 和 DELETE 使用 WHERE 子句

该库要求 UPDATE 和 DELETE 必须使用 WHERE 子句，以防止意外的数据损失：

```js
// ❌ 会抛出错误
sqlBuilder.update("users").set({ status: "inactive" }).build();
// Error: UPDATE query requires WHERE clause

// ✅ 安全写法
sqlBuilder.update("users").set({ status: "inactive" })
  .where("last_login", "<", "2020-01-01")
  .build();
```

### 3. 复用 SQLBuilder 实例

可以重置并复用同一个实例：

```js
const sqlBuilder = new SQLBuilder();

// 第一个查询
const query1 = sqlBuilder.select("*").from("users").build();

// 重置后构建第二个查询
const query2 = sqlBuilder.reset().select("*").from("posts").build();
```

### 4. 对用户可控列使用标识符白名单

如果用户可以指定查询哪些列，请使用白名单：

```js
sqlBuilder.setAllowedIdentifiers(["id", "name", "email", "created_at"]);

// 现在只有这些列可以被使用
const userSelectedColumns = ["email", "created_at"]; // 来自用户输入
const { sql } = sqlBuilder
  .select(userSelectedColumns)
  .from("users")
  .build();
```

### 5. 使用 withTotal() 实现高效分页

不推荐的写法（两次数据库查询）：

```js
// ❌ 效率较低 - 两次数据库查询
const countQuery = sqlBuilder.select("COUNT(*) AS total").from("users").build();
const dataQuery = sqlBuilder.reset().select("*").from("users").limit(10).build();
```

推荐使用 `withTotal()` 一次查询完成：

```js
// ✅ 效率更高 - 一次数据库查询
const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .withTotal()
  .limit(10)
  .build();
```

### 6. 配合数据库驱动执行查询

该库负责构建 SQL 和参数，需要配合您的数据库驱动来执行：

```js
import mysql from "mysql2/promise";
import { SQLBuilder } from "sql-builder.js";

const connection = await mysql.createConnection({ /* 配置 */ });
const sqlBuilder = new SQLBuilder();

const { sql, params } = sqlBuilder
  .select("*")
  .from("users")
  .where("status", "active")
  .build();

const [rows] = await connection.execute(sql, params);
```

## 性能

该库针对高性能进行了优化：

- **缓存正则表达式**：编译一次后重复使用
- **高效字符串构建**：最小化内存分配
- **零依赖**：无外部包带来的额外开销

详细基准测试请参阅 [PERFORMANCE.md](PERFORMANCE.md)。

## TypeScript 支持

该库包含 TypeScript 类型定义：

```typescript
import { SQLBuilder, Transaction, RawExpression, raw } from "sql-builder.js";

const sqlBuilder = new SQLBuilder();

const result: { sql: string; params: any[] } = sqlBuilder
  .select(["id", "name"])
  .from("users")
  .where("status", "active")
  .build();

// raw() 具有完整类型支持
const update = sqlBuilder
  .update("users")
  .set({ age: raw("age + 1"), name: "李四" })
  .where("id", 1)
  .build();
```

## 许可证

[Anti 996 License](LICENSE)
