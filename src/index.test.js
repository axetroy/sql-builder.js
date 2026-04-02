import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import SQLBuilder, { Transaction, RawExpression, raw } from "./index.js";

/**
 * SQLBuilder 单元测试
 */
describe("SQLBuilder", () => {
	/** @type {SQLBuilder} */
	let sqlBuilder;

	beforeEach(() => {
		sqlBuilder = new SQLBuilder();
	});

	afterEach(() => {
		// 清理
		sqlBuilder = null;
	});

	describe("构造函数", () => {
		it("应该成功创建实例", () => {
			assert.doesNotThrow(() => {
				new SQLBuilder();
			});
			assert.strictEqual(typeof new SQLBuilder(), "object");
		});
	});

	describe("reset() 方法", () => {
		it("应该重置构建器状态", () => {
			sqlBuilder.select("id").from("users").where("age", ">", 18);

			const beforeReset = sqlBuilder.getParams();
			assert.strictEqual(beforeReset.length, 1);

			sqlBuilder.reset();

			const afterReset = sqlBuilder.getParams();
			assert.strictEqual(afterReset.length, 0);
			assert.strictEqual(sqlBuilder.getQueryType(), "SELECT");
		});

		it("应该重置 withTotal 字段", () => {
			sqlBuilder.select("id").from("users").withTotal("my_count");

			const { sql: beforeReset } = sqlBuilder.build();
			assert.ok(beforeReset.includes("COUNT(*) OVER()"));

			sqlBuilder.reset().select("id").from("users");

			const { sql: afterReset } = sqlBuilder.build();
			assert.ok(!afterReset.includes("COUNT(*) OVER()"));
		});
	});

	describe("setAllowedIdentifiers() 方法", () => {
		it("应该设置标识符白名单", () => {
			const identifiers = ["users", "id", "name", "email"];
			sqlBuilder.setAllowedIdentifiers(identifiers);

			// 白名单内的标识符应该正常工作
			assert.doesNotThrow(() => {
				sqlBuilder.select("id").from("users").build();
			});
		});

		it("应该拒绝不在白名单中的标识符", () => {
			sqlBuilder.setAllowedIdentifiers(["users", "id"]);

			assert.throws(() => {
				sqlBuilder.select("name").from("users").build();
			}, /Identifier not in whitelist/);
		});

		it("应该验证参数类型", () => {
			assert.throws(() => {
				sqlBuilder.setAllowedIdentifiers("not-an-array");
			}, /Identifiers must be an array/);
		});
	});

	describe("select() 方法", () => {
		it("应该构建基本的 SELECT 查询", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").build();

			assert.strictEqual(sql, "SELECT * FROM `users`");
			assert.deepStrictEqual(params, []);
		});

		it("应该支持多列选择", () => {
			const { sql, params } = sqlBuilder.select(["id", "name", "email"]).from("users").build();

			assert.strictEqual(sql, "SELECT `id`, `name`, `email` FROM `users`");
			assert.deepStrictEqual(params, []);
		});

		it("应该拒绝危险的列名", () => {
			assert.throws(() => {
				sqlBuilder.select("id; DROP TABLE users--").from("users").build();
			}, /Potential SQL injection detected in identifier/);
		});
	});

	describe("from() 方法", () => {
		it("应该设置表名", () => {
			const { sql } = sqlBuilder.select("*").from("users").build();

			assert.strictEqual(sql, "SELECT * FROM `users`");
		});

		it("应该支持表别名", () => {
			const { sql } = sqlBuilder.select("*").from("users u").build();

			assert.strictEqual(sql, "SELECT * FROM `users` `u`");
		});

		it("应该拒绝危险的表名", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users; DROP TABLE users--").build();
			}, /Potential SQL injection detected in identifier/);
		});
	});

	describe("where() 方法", () => {
		it("应该添加基本的 WHERE 条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").where("age", ">", 18).build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `age` > ?");
			assert.deepStrictEqual(params, [18]);
		});

		it("应该支持双参数形式", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").where("name", "John").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `name` = ?");
			assert.deepStrictEqual(params, ["John"]);
		});

		it("应该支持多个 WHERE 条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").where("age", ">", 18).where("status", "active").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `age` > ? AND `status` = ?");
			assert.deepStrictEqual(params, [18, "active"]);
		});

		it("应该拒绝危险的操作符", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").where("age", "UNION SELECT * FROM passwords", 18).build();
			}, /Unsupported or dangerous operator/);
		});
	});

	describe("WHERE 分组（括号嵌套）", () => {
		it("应该支持 AND 分组条件", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where("age", ">", 18)
				.where((q) => q.where("status", "active").orWhere("status", "pending"))
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `age` > ? AND (`status` = ? OR `status` = ?)");
			assert.deepStrictEqual(params, [18, "active", "pending"]);
		});

		it("应该支持 OR 分组条件", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where("type", "vip")
				.orWhere((q) => q.where("age", ">", 60).where("member", true))
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `type` = ? OR (`age` > ? AND `member` = ?)");
			assert.deepStrictEqual(params, ["vip", 60, true]);
		});

		it("应该支持仅有一个分组条件（无前置普通条件）", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where((q) => q.where("status", "active").orWhere("status", "pending"))
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE (`status` = ? OR `status` = ?)");
			assert.deepStrictEqual(params, ["active", "pending"]);
		});

		it("应该支持多个分组条件", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where((q) => q.where("role", "admin").orWhere("role", "moderator"))
				.where((q) => q.where("status", "active").orWhere("status", "pending"))
				.build();

			assert.strictEqual(
				sql,
				"SELECT * FROM `users` WHERE (`role` = ? OR `role` = ?) AND (`status` = ? OR `status` = ?)",
			);
			assert.deepStrictEqual(params, ["admin", "moderator", "active", "pending"]);
		});

		it("应该支持分组内使用 whereIn", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where("age", ">", 18)
				.where((q) => q.whereIn("status", ["active", "pending"]).orWhere("role", "admin"))
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `age` > ? AND (`status` IN (?, ?) OR `role` = ?)");
			assert.deepStrictEqual(params, [18, "active", "pending", "admin"]);
		});

		it("应该支持分组内使用 whereNull / whereNotNull", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where((q) => q.whereNull("deleted_at").orWhere("status", "active"))
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE (`deleted_at` IS NULL OR `status` = ?)");
			assert.deepStrictEqual(params, ["active"]);
		});

		it("应该支持分组内使用 whereBetween", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where("type", "regular")
				.orWhere((q) => q.whereBetween("age", 18, 25).where("status", "active"))
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `type` = ? OR (`age` BETWEEN ? AND ? AND `status` = ?)");
			assert.deepStrictEqual(params, ["regular", 18, 25, "active"]);
		});

		it("应该支持嵌套分组（分组内再分组）", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where("verified", true)
				.where((q) =>
					q
						.where("role", "admin")
						.orWhere((inner) => inner.where("role", "moderator").where("status", "active")),
				)
				.build();

			assert.strictEqual(
				sql,
				"SELECT * FROM `users` WHERE `verified` = ? AND (`role` = ? OR (`role` = ? AND `status` = ?))",
			);
			assert.deepStrictEqual(params, [true, "admin", "moderator", "active"]);
		});

		it("分组条件应该与 UPDATE 查询兼容", () => {
			const { sql, params } = sqlBuilder
				.update("users")
				.set({ status: "inactive" })
				.where("id", 1)
				.where((q) => q.where("role", "guest").orWhere("verified", false))
				.build();

			assert.strictEqual(sql, "UPDATE `users` SET `status` = ? WHERE `id` = ? AND (`role` = ? OR `verified` = ?)");
			assert.deepStrictEqual(params, ["inactive", 1, "guest", false]);
		});

		it("分组条件应该与 DELETE 查询兼容", () => {
			const { sql, params } = sqlBuilder
				.delete("users")
				.where("expired", true)
				.where((q) => q.where("status", "inactive").orWhere("status", "banned"))
				.build();

			assert.strictEqual(sql, "DELETE FROM `users` WHERE `expired` = ? AND (`status` = ? OR `status` = ?)");
			assert.deepStrictEqual(params, [true, "inactive", "banned"]);
		});

		it("分组条件中的标识符应受白名单约束", () => {
			sqlBuilder.setAllowedIdentifiers(["users", "status", "role"]);

			assert.throws(() => {
				sqlBuilder
					.select("*")
					.from("users")
					.where((q) => q.where("unknown_col", "value"))
					.build();
			}, /Identifier not in whitelist/);
		});

		it("空分组回调应被忽略，不影响其他 WHERE 条件", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.where("age", ">", 18)
				.where((q) => {
					// 空回调，不添加任何条件
				})
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `age` > ?");
			assert.deepStrictEqual(params, [18]);
		});
	});

	describe("orWhere() 方法", () => {
		it("应该添加 OR WHERE 条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").where("status", "active").orWhere("status", "pending").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `status` = ? OR `status` = ?");
			assert.deepStrictEqual(params, ["active", "pending"]);
		});
	});

	describe("whereIn() 方法", () => {
		it("应该添加 WHERE IN 条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").whereIn("status", ["active", "pending", "inactive"]).build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `status` IN (?, ?, ?)");
			assert.deepStrictEqual(params, ["active", "pending", "inactive"]);
		});

		it("应该验证数组参数", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").whereIn("status", "not-an-array");
			}, /whereIn requires a non-empty array/);

			assert.throws(() => {
				sqlBuilder.select("*").from("users").whereIn("status", []);
			}, /whereIn requires a non-empty array/);
		});
	});

	describe("whereNotIn() 方法", () => {
		it("应该添加 WHERE NOT IN 条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").whereNotIn("role", ["admin", "superuser"]).build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `role` NOT IN (?, ?)");
			assert.deepStrictEqual(params, ["admin", "superuser"]);
		});

		it("应该验证数组参数", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").whereNotIn("role", "not-an-array");
			}, /whereNotIn requires a non-empty array/);

			assert.throws(() => {
				sqlBuilder.select("*").from("users").whereNotIn("role", []);
			}, /whereNotIn requires a non-empty array/);
		});
	});

	describe("whereLike() 方法", () => {
		it("应该添加 LIKE 条件并自动添加通配符", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").whereLike("name", "John").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `name` LIKE ?");
			assert.deepStrictEqual(params, ["%John%"]);
		});

		it("应该支持禁用通配符", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").whereLike("email", "@example.com", false).build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `email` LIKE ?");
			assert.deepStrictEqual(params, ["@example.com"]);
		});
	});

	describe("whereBetween() 方法", () => {
		it("应该添加 BETWEEN 条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").whereBetween("age", 18, 65).build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `age` BETWEEN ? AND ?");
			assert.deepStrictEqual(params, [18, 65]);
		});
	});

	describe("whereNull() 和 whereNotNull() 方法", () => {
		it("应该添加 IS NULL 条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").whereNull("deleted_at").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `deleted_at` IS NULL");
			assert.deepStrictEqual(params, []);
		});

		it("应该添加 IS NOT NULL 条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").whereNotNull("email").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `email` IS NOT NULL");
			assert.deepStrictEqual(params, []);
		});
	});

	describe("join() 方法", () => {
		it("应该添加 INNER JOIN", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").join("posts", "users.id", "=", "posts.user_id").build();

			assert.strictEqual(sql, "SELECT * FROM `users` INNER JOIN `posts` ON `users`.`id` = `posts`.`user_id`");
			assert.deepStrictEqual(params, []);
		});

		it("应该拒绝危险的 JOIN 条件", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").join("posts;", "users.id", "=", "posts.user_id").build();
			}, /Potential SQL injection detected in identifier/);
		});
	});

	describe("leftJoin() 方法", () => {
		it("应该添加 LEFT JOIN", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").leftJoin("profiles", "users.id", "=", "profiles.user_id").build();

			assert.strictEqual(sql, "SELECT * FROM `users` LEFT JOIN `profiles` ON `users`.`id` = `profiles`.`user_id`");
			assert.deepStrictEqual(params, []);
		});
	});

	describe("orderBy() 方法", () => {
		it("应该添加排序条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").orderBy("created_at", "DESC").build();

			assert.strictEqual(sql, "SELECT * FROM `users` ORDER BY `created_at` DESC");
			assert.deepStrictEqual(params, []);
		});

		it("应该验证排序方向", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").orderBy("created_at", "INVALID").build();
			}, /Order direction must be ASC or DESC/);
		});

		it("应该支持多列排序（链式调用）", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.orderBy("status", "ASC")
				.orderBy("created_at", "DESC")
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` ORDER BY `status` ASC, `created_at` DESC");
			assert.deepStrictEqual(params, []);
		});

		it("应该支持多列排序（数组形式）", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("users")
				.orderBy([
					["status", "ASC"],
					["created_at", "DESC"],
				])
				.build();

			assert.strictEqual(sql, "SELECT * FROM `users` ORDER BY `status` ASC, `created_at` DESC");
			assert.deepStrictEqual(params, []);
		});

		it("应该验证数组形式多列排序的方向", () => {
			assert.throws(() => {
				sqlBuilder
					.select("*")
					.from("users")
					.orderBy([["created_at", "INVALID"]])
					.build();
			}, /Order direction must be ASC or DESC/);
		});
	});

	describe("groupBy() 方法", () => {
		it("应该添加分组条件", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").groupBy("category").build();

			assert.strictEqual(sql, "SELECT * FROM `users` GROUP BY `category`");
			assert.deepStrictEqual(params, []);
		});

		it("应该支持多列分组", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").groupBy(["category", "status"]).build();

			assert.strictEqual(sql, "SELECT * FROM `users` GROUP BY `category`, `status`");
			assert.deepStrictEqual(params, []);
		});
	});

	describe("limit() 和 offset() 方法", () => {
		it("应该添加 LIMIT 和 OFFSET", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").limit(10).offset(20).build();

			assert.strictEqual(sql, "SELECT * FROM `users` LIMIT 10 OFFSET 20");
			assert.deepStrictEqual(params, []);
		});

		it("应该验证 LIMIT 参数", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").limit(-1).build();
			}, /Limit must be a positive integer/);

			assert.throws(() => {
				sqlBuilder.select("*").from("users").limit(5.5).build();
			}, /Limit must be a positive integer/);
		});

		it("应该验证 OFFSET 参数", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").offset(-1).build();
			}, /Offset must be a non-negative integer/);

			assert.throws(() => {
				sqlBuilder.select("*").from("users").offset(5.5).build();
			}, /Offset must be a non-negative integer/);
		});
	});

	describe("insert() 方法", () => {
		it("应该构建 INSERT 查询", () => {
			const { sql, params } = sqlBuilder
				.insert("users", {
					name: "John Doe",
					email: "john@example.com",
					age: 25,
				})
				.build();

			assert.strictEqual(sql, "INSERT INTO `users` (`name`, `email`, `age`) VALUES (?, ?, ?)");
			assert.deepStrictEqual(params, ["John Doe", "john@example.com", 25]);
		});

		it("应该拒绝危险的列名", () => {
			assert.throws(() => {
				sqlBuilder
					.insert("users", {
						"name; DROP TABLE users--": "test",
					})
					.build();
			}, /Potential SQL injection detected in identifier/);
		});

		it("应该拒绝空数据对象", () => {
			assert.throws(() => {
				sqlBuilder.insert("users", {}).build();
			}, /Insert data cannot be empty/);

			assert.throws(() => {
				sqlBuilder.insert("users", null).build();
			}, /Insert data cannot be empty/);
		});
	});

	describe("update() 方法", () => {
		it("应该构建 UPDATE 查询", () => {
			const { sql, params } = sqlBuilder
				.update("users")
				.set({
					name: "Jane Doe",
					email: "jane@example.com",
				})
				.where("id", 1)
				.build();

			assert.strictEqual(sql, "UPDATE `users` SET `name` = ?, `email` = ? WHERE `id` = ?");
			assert.deepStrictEqual(params, ["Jane Doe", "jane@example.com", 1]);
		});

		it("自动过滤掉 undefined 值", () => {
			const { sql, params } = sqlBuilder
				.update("users")
				.set({
					name: "Jane Doe",
					email: undefined, // 这个字段应该被忽略
					age: 30,
				})
				.where("id", 1)
				.build();

			assert.strictEqual(sql, "UPDATE `users` SET `name` = ?, `age` = ? WHERE `id` = ?");
			assert.deepStrictEqual(params, ["Jane Doe", 30, 1]);
		});

		it("应该要求 WHERE 条件", () => {
			assert.throws(() => {
				sqlBuilder.update("users").set({ name: "Test" }).build();
			}, /UPDATE query requires WHERE clause/);
		});

		it("应该拒绝空数据对象", () => {
			assert.throws(() => {
				sqlBuilder.update("users").set({}).where("id", 1).build();
			}, /Update data cannot be empty/);

			assert.throws(() => {
				sqlBuilder.update("users").set(null).where("id", 1).build();
			}, /Update data cannot be empty/);
		});

		it("应该要求调用 set() 方法", () => {
			assert.throws(() => {
				sqlBuilder.update("users").where("id", 1).build();
			}, /Update data cannot be empty/);
		});

		it("应该支持 set(column, rawExpression) 简写形式", () => {
			const { sql, params } = sqlBuilder
				.update("users")
				.set("age", "age + 1")
				.where("id", 1)
				.build();

			assert.strictEqual(sql, "UPDATE `users` SET `age` = age + 1 WHERE `id` = ?");
			assert.deepStrictEqual(params, [1]);
		});

		it("应该支持数据对象中使用 raw() 表达式", () => {
			const { sql, params } = sqlBuilder
				.update("users")
				.set({ age: raw("age + 1") })
				.where("id", 1)
				.build();

			assert.strictEqual(sql, "UPDATE `users` SET `age` = age + 1 WHERE `id` = ?");
			assert.deepStrictEqual(params, [1]);
		});

		it("应该支持混合普通值和 raw() 表达式", () => {
			const { sql, params } = sqlBuilder
				.update("users")
				.set({ age: raw("age + 1"), name: "Jane" })
				.where("id", 1)
				.build();

			assert.strictEqual(sql, "UPDATE `users` SET `age` = age + 1, `name` = ? WHERE `id` = ?");
			assert.deepStrictEqual(params, ["Jane", 1]);
		});

		it("应该拒绝空的原始表达式字符串", () => {
			assert.throws(() => {
				raw("");
			}, /Raw expression must be a non-empty string/);

			assert.throws(() => {
				sqlBuilder.update("users").set("age", "");
			}, /Raw expression must be a non-empty string/);
		});
	});

	describe("delete() 方法", () => {
		it("应该构建 DELETE 查询", () => {
			const { sql, params } = sqlBuilder.delete("users").where("status", "inactive").build();

			assert.strictEqual(sql, "DELETE FROM `users` WHERE `status` = ?");
			assert.deepStrictEqual(params, ["inactive"]);
		});

		it("应该要求 WHERE 条件", () => {
			assert.throws(() => {
				sqlBuilder.delete("users").build();
			}, /DELETE query requires WHERE clause/);
		});
	});

	describe("复杂查询", () => {
		it("应该构建复杂的 SELECT 查询", () => {
			const { sql, params } = sqlBuilder
				.select(["u.id", "u.name", "p.title"])
				.from("users u")
				.leftJoin("posts p", "u.id", "=", "p.user_id")
				.where("u.age", ">=", 18)
				.whereIn("u.status", ["active", "pending"])
				.whereNotNull("u.email")
				.groupBy("u.role")
				.orderBy("u.created_at", "DESC")
				.limit(20)
				.offset(10)
				.build();

			const expectedSQL =
				"SELECT `u`.`id`, `u`.`name`, `p`.`title` FROM `users` `u` " +
				"LEFT JOIN `posts` `p` ON `u`.`id` = `p`.`user_id` " +
				"WHERE `u`.`age` >= ? AND `u`.`status` IN (?, ?) AND `u`.`email` IS NOT NULL " +
				"GROUP BY `u`.`role` ORDER BY `u`.`created_at` DESC LIMIT 20 OFFSET 10";

			assert.strictEqual(sql, expectedSQL);
			assert.deepStrictEqual(params, [18, "active", "pending"]);
		});
	});

	describe("toString() 方法", () => {
		it("应该返回格式化的 SQL 字符串", () => {
			const formattedSQL = sqlBuilder.select("*").from("users").where("age", ">", 18).where("name", "John").toString();

			assert.strictEqual(formattedSQL, "SELECT * FROM `users` WHERE `age` > 18 AND `name` = 'John'");
		});
	});

	describe("getParams() 方法", () => {
		it("应该返回参数数组", () => {
			sqlBuilder.select("*").from("users").where("age", ">", 18).where("name", "John");

			const params = sqlBuilder.getParams();
			assert.deepStrictEqual(params, [18, "John"]);
		});
	});

	describe("getQueryType() 方法", () => {
		it("应该返回当前查询类型", () => {
			sqlBuilder.select("*").from("users");
			assert.strictEqual(sqlBuilder.getQueryType(), "SELECT");

			sqlBuilder.reset().insert("users", { name: "test" });
			assert.strictEqual(sqlBuilder.getQueryType(), "INSERT");

			sqlBuilder.reset().update("users").set({ name: "test" });
			assert.strictEqual(sqlBuilder.getQueryType(), "UPDATE");

			sqlBuilder.reset().delete("users");
			assert.strictEqual(sqlBuilder.getQueryType(), "DELETE");
		});
	});

	describe("SQL 注入防护", () => {
		it("应该阻止表名注入", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users; DROP TABLE users--").build();
			}, /Potential SQL injection detected in identifier/);
		});

		it("应该阻止列名注入", () => {
			assert.throws(() => {
				sqlBuilder.select("id; DROP TABLE users--").from("users").build();
			}, /Potential SQL injection detected in identifier/);
		});

		it("应该阻止操作符注入", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").where("age", "UNION SELECT * FROM passwords", 18).build();
			}, /Unsupported or dangerous operator/);
		});

		it("应该参数化所有值", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").where("name", "'; DROP TABLE users--").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `name` = ?");
			assert.deepStrictEqual(params, ["'; DROP TABLE users--"]);
		});
	});

	describe("withTotal() 方法", () => {
		it("应该在 SELECT 查询中添加总数统计", () => {
			const { sql, params } = sqlBuilder
				.select(["id", "name", "email"])
				.from("users")
				.where("status", "active")
				.withTotal()
				.limit(10)
				.build();

			assert.strictEqual(
				sql,
				"SELECT `id`, `name`, `email`, COUNT(*) OVER() AS __total_count FROM `users` WHERE `status` = ? LIMIT 10",
			);
			assert.deepStrictEqual(params, ["active"]);
		});

		it("应该支持禁用总数统计", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").withTotal(false).build();

			assert.strictEqual(sql, "SELECT * FROM `users`");
			assert.deepStrictEqual(params, []);
		});

		it("应该在复杂查询中正确添加总数统计", () => {
			const { sql, params } = sqlBuilder
				.select(["u.id", "u.name", "p.title"])
				.from("users u")
				.leftJoin("posts p", "u.id", "=", "p.user_id")
				.where("u.age", ">=", 18)
				.whereIn("u.status", ["active", "pending"])
				.withTotal()
				.orderBy("u.created_at", "DESC")
				.limit(20)
				.offset(10)
				.build();

			const expectedSQL =
				"SELECT `u`.`id`, `u`.`name`, `p`.`title`, COUNT(*) OVER() AS __total_count FROM `users` `u` " +
				"LEFT JOIN `posts` `p` ON `u`.`id` = `p`.`user_id` " +
				"WHERE `u`.`age` >= ? AND `u`.`status` IN (?, ?) " +
				"ORDER BY `u`.`created_at` DESC LIMIT 20 OFFSET 10";

			assert.strictEqual(sql, expectedSQL);
			assert.deepStrictEqual(params, [18, "active", "pending"]);
		});

		it("应该与 GROUP BY 子句兼容", () => {
			const { sql, params } = sqlBuilder
				.select(["category", "COUNT(*) as count"])
				.from("products")
				.groupBy("category")
				.withTotal()
				.build();

			assert.strictEqual(
				sql,
				"SELECT `category`, COUNT(*) AS `count`, COUNT(*) OVER() AS __total_count FROM `products` GROUP BY `category`",
			);
			assert.deepStrictEqual(params, []);
		});

		it("应该在分页场景中正确工作", () => {
			const page = 2;
			const pageSize = 10;
			const { sql, params } = sqlBuilder
				.select(["id", "title", "created_at"])
				.from("articles")
				.where("published", true)
				.withTotal()
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.orderBy("created_at", "DESC")
				.build();

			assert.strictEqual(
				sql,
				"SELECT `id`, `title`, `created_at`, COUNT(*) OVER() AS __total_count FROM `articles` WHERE `published` = ? ORDER BY `created_at` DESC LIMIT 10 OFFSET 10",
			);
			assert.deepStrictEqual(params, [true]);
		});
	});

	describe("分页查询工具方法", () => {
		it("应该正确处理分页参数", () => {
			// 模拟分页查询构建
			function buildPaginatedQuery(page, pageSize, filters = {}) {
				const offset = (page - 1) * pageSize;

				let builder = sqlBuilder
					.reset()
					.select(["id", "name", "email"])
					.from("users")
					.withTotal()
					.limit(pageSize)
					.offset(offset)
					.orderBy("id", "ASC");

				// 添加过滤条件
				if (filters.status) {
					builder = builder.where("status", filters.status);
				}
				if (filters.search) {
					builder = builder.whereLike("name", filters.search);
				}

				return builder.build();
			}

			const { sql, params } = buildPaginatedQuery(1, 10, {
				status: "active",
				search: "john",
			});

			assert.strictEqual(
				sql,
				"SELECT `id`, `name`, `email`, COUNT(*) OVER() AS __total_count FROM `users` WHERE `status` = ? AND `name` LIKE ? ORDER BY `id` ASC LIMIT 10 OFFSET 0",
			);
			assert.deepStrictEqual(params, ["active", "%john%"]);
		});
	});

	describe("Transaction 类", () => {
		it("应该成功创建 Transaction 实例", () => {
			assert.doesNotThrow(() => {
				new Transaction();
			});
		});

		it("应该构建包含单个 INSERT 的事务", () => {
			const { sql, params } = new Transaction()
				.add(new SQLBuilder().insert("users", { name: "John", email: "john@example.com" }))
				.build();

			assert.strictEqual(sql, "BEGIN;\nINSERT INTO `users` (`name`, `email`) VALUES (?, ?);\nCOMMIT;");
			assert.deepStrictEqual(params, ["John", "john@example.com"]);
		});

		it("应该构建包含多个查询的事务", () => {
			const { sql, params } = new Transaction()
				.add(new SQLBuilder().insert("users", { name: "John" }))
				.add(new SQLBuilder().update("accounts").set({ balance: 100 }).where("id", 1))
				.build();

			assert.strictEqual(
				sql,
				"BEGIN;\nINSERT INTO `users` (`name`) VALUES (?);\nUPDATE `accounts` SET `balance` = ? WHERE `id` = ?;\nCOMMIT;",
			);
			assert.deepStrictEqual(params, ["John", 100, 1]);
		});

		it("应该支持 SAVEPOINT", () => {
			const { sql, params } = new Transaction()
				.add(new SQLBuilder().insert("users", { name: "John" }))
				.savepoint("sp1")
				.add(new SQLBuilder().update("accounts").set({ balance: 100 }).where("id", 1))
				.releaseSavepoint("sp1")
				.build();

			assert.strictEqual(
				sql,
				"BEGIN;\nINSERT INTO `users` (`name`) VALUES (?);\nSAVEPOINT sp1;\nUPDATE `accounts` SET `balance` = ? WHERE `id` = ?;\nRELEASE SAVEPOINT sp1;\nCOMMIT;",
			);
			assert.deepStrictEqual(params, ["John", 100, 1]);
		});

		it("应该支持 ROLLBACK TO SAVEPOINT", () => {
			const { sql, params } = new Transaction()
				.add(new SQLBuilder().insert("users", { name: "John" }))
				.savepoint("sp1")
				.add(new SQLBuilder().update("accounts").set({ balance: 100 }).where("id", 1))
				.rollbackTo("sp1")
				.build();

			assert.strictEqual(
				sql,
				"BEGIN;\nINSERT INTO `users` (`name`) VALUES (?);\nSAVEPOINT sp1;\nUPDATE `accounts` SET `balance` = ? WHERE `id` = ?;\nROLLBACK TO SAVEPOINT sp1;\nCOMMIT;",
			);
			assert.deepStrictEqual(params, ["John", 100, 1]);
		});

		it("应该支持空事务", () => {
			const { sql, params } = new Transaction().build();

			assert.strictEqual(sql, "BEGIN;\nCOMMIT;");
			assert.deepStrictEqual(params, []);
		});

		it("应该验证 add() 参数必须是 SQLBuilder 实例", () => {
			assert.throws(() => {
				new Transaction().add("not a builder");
			}, /Transaction\.add\(\) requires a SQLBuilder instance/);

			assert.throws(() => {
				new Transaction().add({ build: () => {} });
			}, /Transaction\.add\(\) requires a SQLBuilder instance/);
		});

		it("应该验证 savepoint 名称合法性", () => {
			assert.throws(() => {
				new Transaction().savepoint("invalid name");
			}, /Invalid savepoint name/);

			assert.throws(() => {
				new Transaction().savepoint("123invalid");
			}, /Invalid savepoint name/);

			assert.throws(() => {
				new Transaction().savepoint("");
			}, /Invalid savepoint name/);
		});

		it("应该验证 releaseSavepoint 名称合法性", () => {
			assert.throws(() => {
				new Transaction().releaseSavepoint("bad name!");
			}, /Invalid savepoint name/);
		});

		it("应该验证 rollbackTo 名称合法性", () => {
			assert.throws(() => {
				new Transaction().rollbackTo("bad-name");
			}, /Invalid savepoint name/);
		});

		it("应该合并多个查询的参数", () => {
			const { params } = new Transaction()
				.add(new SQLBuilder().insert("orders", { user_id: 1, total: 99.99 }))
				.add(new SQLBuilder().update("inventory").set({ stock: 10 }).where("product_id", 5))
				.add(new SQLBuilder().delete("cart").where("user_id", 1))
				.build();

			assert.deepStrictEqual(params, [1, 99.99, 10, 5, 1]);
		});

		it("应该支持 BEGIN DEFERRED", () => {
			const { sql, params } = new Transaction("DEFERRED")
				.add(new SQLBuilder().insert("users", { name: "John" }))
				.build();

			assert.strictEqual(sql, "BEGIN DEFERRED;\nINSERT INTO `users` (`name`) VALUES (?);\nCOMMIT;");
			assert.deepStrictEqual(params, ["John"]);
		});

		it("应该支持 BEGIN IMMEDIATE", () => {
			const { sql, params } = new Transaction("IMMEDIATE")
				.add(new SQLBuilder().insert("users", { name: "John" }))
				.build();

			assert.strictEqual(sql, "BEGIN IMMEDIATE;\nINSERT INTO `users` (`name`) VALUES (?);\nCOMMIT;");
			assert.deepStrictEqual(params, ["John"]);
		});

		it("应该支持 BEGIN EXCLUSIVE", () => {
			const { sql, params } = new Transaction("EXCLUSIVE")
				.add(new SQLBuilder().insert("users", { name: "John" }))
				.build();

			assert.strictEqual(sql, "BEGIN EXCLUSIVE;\nINSERT INTO `users` (`name`) VALUES (?);\nCOMMIT;");
			assert.deepStrictEqual(params, ["John"]);
		});

		it("应该验证 Transaction 构造函数的 type 参数合法性", () => {
			assert.throws(() => {
				new Transaction("INVALID");
			}, /Invalid transaction type/);

			assert.throws(() => {
				new Transaction("begin");
			}, /Invalid transaction type/);

			assert.throws(() => {
				new Transaction(123);
			}, /Invalid transaction type/);
		});
	});

	describe("lock() 方法", () => {
		it("应该支持 FOR UPDATE 锁", () => {
			const { sql, params } = sqlBuilder.select("*").from("users").where("id", 1).lock("FOR UPDATE").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `id` = ? FOR UPDATE");
			assert.deepStrictEqual(params, [1]);
		});

		it("应该支持 FOR SHARE 锁", () => {
			const { sql, params } = sqlBuilder.select("*").from("accounts").where("id", 2).lock("FOR SHARE").build();

			assert.strictEqual(sql, "SELECT * FROM `accounts` WHERE `id` = ? FOR SHARE");
			assert.deepStrictEqual(params, [2]);
		});

		it("应该支持 LOCK IN SHARE MODE 锁", () => {
			const { sql, params } = sqlBuilder
				.select("*")
				.from("orders")
				.where("status", "pending")
				.lock("LOCK IN SHARE MODE")
				.build();

			assert.strictEqual(sql, "SELECT * FROM `orders` WHERE `status` = ? LOCK IN SHARE MODE");
			assert.deepStrictEqual(params, ["pending"]);
		});

		it("应该忽略大小写", () => {
			const { sql } = sqlBuilder.select("*").from("users").where("id", 1).lock("for update").build();

			assert.strictEqual(sql, "SELECT * FROM `users` WHERE `id` = ? FOR UPDATE");
		});

		it("应该拒绝无效的锁定模式", () => {
			assert.throws(() => {
				sqlBuilder.select("*").from("users").lock("INVALID MODE");
			}, /Invalid lock mode/);

			assert.throws(() => {
				sqlBuilder.select("*").from("users").lock("");
			}, /Invalid lock mode/);

			assert.throws(() => {
				sqlBuilder.select("*").from("users").lock(null);
			}, /Invalid lock mode/);
		});

		it("应该在事务中正确使用 FOR UPDATE 锁", () => {
			const { sql, params } = new Transaction()
				.add(new SQLBuilder().select("*").from("users").where("id", 1).lock("FOR UPDATE"))
				.add(new SQLBuilder().update("users").set({ name: "Jane" }).where("id", 1))
				.build();

			assert.strictEqual(
				sql,
				"BEGIN;\nSELECT * FROM `users` WHERE `id` = ? FOR UPDATE;\nUPDATE `users` SET `name` = ? WHERE `id` = ?;\nCOMMIT;",
			);
			assert.deepStrictEqual(params, [1, "Jane", 1]);
		});

		it("reset() 应该清除锁定状态", () => {
			sqlBuilder.select("*").from("users").where("id", 1).lock("FOR UPDATE");
			sqlBuilder.reset();

			const { sql } = sqlBuilder.select("*").from("users").where("id", 1).build();

			assert.ok(!sql.includes("FOR UPDATE"));
		});
	});
});
