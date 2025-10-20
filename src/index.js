/**
 * 安全的 SQL 查询构建器
 * 提供全面的 SQL 注入防护，使用参数化查询和标识符验证
 * @class SQLBuilder
 * @example
 * const sql = new SQLBuilder();
 * const query = sql.select('*').from('users').where('age', '>', 18).build();
 * console.log(query.sql); // SELECT * FROM `users` WHERE `age` > ?
 * console.log(query.params); // [18]
 */
class SQLBuilder {
	/**
	 * @private
	 */
	#query = {
		type: "SELECT",
		table: null,
		tableAlias: null,
		columns: ["*"],
		where: [],
		joins: [],
		orderBy: [],
		groupBy: [],
		having: [],
		limit: null,
		offset: null,
		values: {},
		set: {},
		withTotal: undefined,
	};

	/**
	 * @private
	 * @type {Array<any>}
	 */
	#params = [];

	/**
	 * @private
	 * @type {Set<string>}
	 */
	#allowedIdentifiers = new Set();

	/**
	 * 允许的 SQL 操作符白名单
	 * @private
	 * @type {Set<string>}
	 */
	#allowedOperators = new Set(["=", "!=", "<>", "<", ">", "<=", ">=", "LIKE", "IN", "NOT IN", "IS", "IS NOT", "BETWEEN"]);

	/**
	 * 创建 SQLBuilder 实例
	 * @constructor
	 * @example
	 * const sql = new SQLBuilder();
	 */
	constructor() {
		// 初始化时可以配置默认白名单
		this.#allowedIdentifiers = new Set();
	}

	/**
	 * 转义 SQL 标识符（表名、列名）
	 * @private
	 * @param {string} identifier - 要转义的标识符
	 * @returns {string} 转义后的标识符
	 * @throws {Error} 当标识符包含非法字符时抛出错误
	 */
	#escapeIdentifier(identifier) {
		if (typeof identifier !== "string") {
			throw new Error("Identifier must be a string");
		}

		// 允许字母、数字、下划线、点号（用于 table.column）
		if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(identifier)) {
			// 兼容 COUNT(*) AS total 等函数调用的情况
			const match = /^COUNT\(\*\)\s+AS\s+(.+)$/i.exec(identifier);

			if (match) {
				const alias = match[1];
				return `COUNT(*) AS ${this.#escapeIdentifier(alias)}`;
			}

			throw new Error(`Invalid identifier format: ${identifier}`);
		}

		// 分割可能有的表别名 (table.column)
		const parts = identifier.split(".");
		return parts.map((part) => `\`${part}\``).join(".");
	}

	/**
	 * 解析表名和别名
	 * @private
	 * @param {string} table - 表名，可以包含别名（如 "users u"）
	 * @returns {{table: string, alias: string|null}} 解析后的表名和别名
	 */
	#parseTableAndAlias(table) {
		const parts = table.trim().split(/\s+/);
		const mainTable = parts[0];
		const alias = parts.length > 1 ? parts[1] : null;

		return { table: mainTable, alias };
	}

	/**
	 * 验证标识符是否安全
	 * @private
	 * @param {string} identifier - 要验证的标识符
	 * @throws {Error} 当标识符不安全时抛出错误
	 */
	#validateIdentifier(identifier) {
		if (typeof identifier !== "string") {
			throw new Error("Identifier must be a string");
		}

		// 基本格式验证
		if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(identifier)) {
			// 兼容 COUNT(*) AS total 等函数调用的情况
			const match = /^COUNT\(\*\)\s+AS\s+(.+)$/i.exec(identifier);

			if (match) {
				const alias = match[1];
				return this.#validateIdentifier(alias);
			}

			throw new Error(`Potential SQL injection detected in identifier: ${identifier}`);
		}

		// 白名单验证（如果设置了白名单）
		if (this.#allowedIdentifiers.size > 0 && !this.#allowedIdentifiers.has(identifier)) {
			throw new Error(`Identifier not in whitelist: ${identifier}`);
		}
	}

	/**
	 * 验证操作符是否安全
	 * @private
	 * @param {string} operator - 要验证的操作符
	 * @throws {Error} 当操作符不在白名单时抛出错误
	 */
	#validateOperator(operator) {
		if (!this.#allowedOperators.has(operator.toUpperCase())) {
			throw new Error(`Unsupported or dangerous operator: ${operator}`);
		}
	}

	/**
	 * 设置标识符白名单
	 * @param {string[]} identifiers - 允许的标识符列表
	 * @returns {SQLBuilder}
	 * @example
	 * sql.setAllowedIdentifiers(['users', 'id', 'name', 'email']);
	 */
	setAllowedIdentifiers(identifiers) {
		if (!Array.isArray(identifiers)) {
			throw new Error("Identifiers must be an array");
		}

		this.#allowedIdentifiers = new Set(identifiers);
		return this;
	}

	/**
	 * 重置构建器状态
	 * @returns {SQLBuilder}
	 * @example
	 * sql.reset().select('*').from('users');
	 */
	reset() {
		this.#query = {
			type: "SELECT",
			table: null,
			tableAlias: null,
			columns: ["*"],
			where: [],
			joins: [],
			orderBy: [],
			groupBy: [],
			having: [],
			limit: null,
			offset: null,
			values: {},
			set: {},
		};
		this.#params = [];
		return this;
	}

	/**
	 * 设置 SELECT 查询的列
	 * @param {string|string[]} columns - 要查询的列名，默认为 ['*']
	 * @returns {SQLBuilder}
	 * @example
	 * sql.select('id', 'name');
	 * sql.select(['id', 'name', 'email']);
	 * sql.select('*'); // 查询所有列
	 * sql.select(['u.id', 'u.name']); // 使用表别名
	 */
	select(columns = ["*"]) {
		this.#query.type = "SELECT";

		if (columns === "*") {
			this.#query.columns = ["*"];
		} else {
			const columnArray = Array.isArray(columns) ? columns : [columns];
			this.#query.columns = columnArray.map((col) => {
				if (col !== "*") {
					this.#validateIdentifier(col);
					return this.#escapeIdentifier(col);
				}
				return col;
			});
		}

		return this;
	}

	/**
	 * 设置查询的表名
	 * @param {string} table - 表名，可以包含别名（如 "users u" 或 "users AS u"）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.from('users');
	 * sql.from('users u'); // 使用表别名
	 * sql.from('users AS u'); // 使用 AS 关键字
	 * sql.from('database.users'); // 使用数据库限定表名
	 */
	from(table) {
		const { table: tableName, alias } = this.#parseTableAndAlias(table.replace(/ AS /i, " "));

		this.#validateIdentifier(tableName);
		if (alias) {
			this.#validateIdentifier(alias);
		}

		this.#query.table = this.#escapeIdentifier(tableName);
		this.#query.tableAlias = alias ? this.#escapeIdentifier(alias) : null;

		return this;
	}

	/**
	 * 添加 WHERE 条件
	 * @param {string} column - 列名，可以使用表别名（如 "u.id"）
	 * @param {string} [operator] - 操作符，默认为 '='
	 * @param {any} [value] - 值（当只有两个参数时，第二个参数作为值）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.where('age', '>', 18);
	 * sql.where('name', 'John'); // 默认使用 = 操作符
	 * sql.where('status', 'IS', null);
	 * sql.where('u.id', 1); // 使用表别名
	 */
	where(column, operator, value) {
		if (arguments.length === 2) {
			value = operator;
			operator = "=";
		}

		this.#validateIdentifier(column);
		this.#validateOperator(operator);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator,
			value,
			connector: "AND",
		});

		// 对于 IS NULL 和 IS NOT NULL，不需要参数
		if (operator.toUpperCase() !== "IS" || (value !== null && value !== "NULL")) {
			this.#params.push(value);
		}

		return this;
	}

	/**
	 * 添加 OR WHERE 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {string} [operator] - 操作符，默认为 '='
	 * @param {any} [value] - 值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.where('status', 'active').orWhere('status', 'pending');
	 * sql.orWhere('u.role', 'admin'); // 使用表别名
	 */
	orWhere(column, operator, value) {
		if (arguments.length === 2) {
			value = operator;
			operator = "=";
		}

		this.#validateIdentifier(column);
		this.#validateOperator(operator);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator,
			value,
			connector: "OR",
		});

		if (operator.toUpperCase() !== "IS" || (value !== null && value !== "NULL")) {
			this.#params.push(value);
		}

		return this;
	}

	/**
	 * 添加 WHERE IN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any[]} values - 值数组
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 values 不是数组或为空时抛出错误
	 * @example
	 * sql.whereIn('status', ['active', 'pending', 'inactive']);
	 * sql.whereIn('u.role', ['admin', 'user']); // 使用表别名
	 */
	whereIn(column, values) {
		if (!Array.isArray(values) || values.length === 0) {
			throw new Error("whereIn requires a non-empty array");
		}

		this.#validateIdentifier(column);

		const placeholders = values.map(() => "?").join(", ");

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IN",
			value: `(${placeholders})`,
			connector: "AND",
		});
		this.#params.push(...values);

		return this;
	}

	/**
	 * 添加 WHERE NOT IN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any[]} values - 值数组
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereNotIn('role', ['admin', 'superuser']);
	 * sql.whereNotIn('u.category', [1, 2, 3]); // 使用表别名
	 */
	whereNotIn(column, values) {
		if (!Array.isArray(values) || values.length === 0) {
			throw new Error("whereNotIn requires a non-empty array");
		}

		this.#validateIdentifier(column);

		const placeholders = values.map(() => "?").join(", ");
		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "NOT IN",
			value: `(${placeholders})`,
			connector: "AND",
		});
		this.#params.push(...values);

		return this;
	}

	/**
	 * 添加 LIKE 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {string} value - 搜索值
	 * @param {boolean} [wildcard=true] - 是否自动添加 % 通配符
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereLike('name', 'John'); // 搜索包含 'John' 的名称
	 * sql.whereLike('email', '@example.com', false); // 精确匹配结尾
	 * sql.whereLike('u.username', 'admin'); // 使用表别名
	 */
	whereLike(column, value, wildcard = true) {
		this.#validateIdentifier(column);

		const searchValue = wildcard ? `%${value}%` : value;

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "LIKE",
			value: searchValue,
			connector: "AND",
		});
		this.#params.push(searchValue);

		return this;
	}

	/**
	 * 添加 BETWEEN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any} start - 范围开始值
	 * @param {any} end - 范围结束值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereBetween('age', 18, 65);
	 * sql.whereBetween('created_at', '2023-01-01', '2023-12-31');
	 * sql.whereBetween('u.score', 80, 100); // 使用表别名
	 */
	whereBetween(column, start, end) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "BETWEEN",
			value: `? AND ?`,
			connector: "AND",
		});
		this.#params.push(start, end);

		return this;
	}

	/**
	 * 添加 IS NULL 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereNull('deleted_at');
	 * sql.whereNull('u.deleted_at'); // 使用表别名
	 */
	whereNull(column) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IS",
			value: null,
			connector: "AND",
		});

		return this;
	}

	/**
	 * 添加 IS NOT NULL 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereNotNull('email');
	 * sql.whereNotNull('u.email'); // 使用表别名
	 */
	whereNotNull(column) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IS NOT",
			value: null,
			connector: "AND",
		});

		return this;
	}

	/**
	 * 添加 INNER JOIN 连接
	 * @param {string} table - 要连接的表名，可以包含别名
	 * @param {string} first - 第一个连接条件列
	 * @param {string} operator - 操作符
	 * @param {string} second - 第二个连接条件列
	 * @returns {SQLBuilder}
	 * @example
	 * sql.join('posts', 'users.id', '=', 'posts.user_id');
	 * sql.join('profiles p', 'users.id', '=', 'p.user_id'); // 使用表别名
	 * sql.join('database.posts p', 'u.id', '=', 'p.user_id'); // 使用数据库限定表名和别名
	 */
	join(table, first, operator, second) {
		const { table: tableName, alias } = this.#parseTableAndAlias(table.replace(/ AS /i, " "));

		this.#validateIdentifier(tableName);
		if (alias) {
			this.#validateIdentifier(alias);
		}
		this.#validateIdentifier(first);
		this.#validateIdentifier(second);
		this.#validateOperator(operator);

		const escapedTable = this.#escapeIdentifier(tableName);
		const joinedTable = alias ? `${escapedTable} ${this.#escapeIdentifier(alias)}` : escapedTable;

		this.#query.joins.push({
			type: "INNER",
			table: joinedTable,
			condition: {
				first: this.#escapeIdentifier(first),
				operator,
				second: this.#escapeIdentifier(second),
			},
		});
		return this;
	}

	/**
	 * 添加 LEFT JOIN 连接
	 * @param {string} table - 要连接的表名，可以包含别名
	 * @param {string} first - 第一个连接条件列
	 * @param {string} operator - 操作符
	 * @param {string} second - 第二个连接条件列
	 * @returns {SQLBuilder}
	 * @example
	 * sql.leftJoin('profiles', 'users.id', '=', 'profiles.user_id');
	 * sql.leftJoin('profiles p', 'users.id', '=', 'p.user_id'); // 使用表别名
	 */
	leftJoin(table, first, operator, second) {
		const { table: tableName, alias } = this.#parseTableAndAlias(table.replace(/ AS /i, " "));

		this.#validateIdentifier(tableName);
		if (alias) {
			this.#validateIdentifier(alias);
		}
		this.#validateIdentifier(first);
		this.#validateIdentifier(second);
		this.#validateOperator(operator);

		const escapedTable = this.#escapeIdentifier(tableName);
		const joinedTable = alias ? `${escapedTable} ${this.#escapeIdentifier(alias)}` : escapedTable;

		this.#query.joins.push({
			type: "LEFT",
			table: joinedTable,
			condition: {
				first: this.#escapeIdentifier(first),
				operator,
				second: this.#escapeIdentifier(second),
			},
		});
		return this;
	}

	/**
	 * 添加排序条件
	 * @param {string} column - 排序列名，可以使用表别名
	 * @param {'ASC'|'DESC'} direction - 排序方向
	 * @returns {SQLBuilder}
	 * @example
	 * sql.orderBy('created_at', 'DESC');
	 * sql.orderBy('name', 'ASC');
	 * sql.orderBy('u.created_at', 'DESC'); // 使用表别名
	 */
	orderBy(column, direction = "ASC") {
		this.#validateIdentifier(column);

		const upperDirection = direction.toUpperCase();
		if (!["ASC", "DESC"].includes(upperDirection)) {
			throw new Error("Order direction must be ASC or DESC");
		}

		this.#query.orderBy.push({
			column: this.#escapeIdentifier(column),
			direction: upperDirection,
		});
		return this;
	}

	/**
	 * 添加分组条件
	 * @param {string|string[]} columns - 分组列名，可以使用表别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.groupBy('category');
	 * sql.groupBy(['category', 'status']);
	 * sql.groupBy(['u.category', 'u.status']); // 使用表别名
	 */
	groupBy(columns) {
		const columnArray = Array.isArray(columns) ? columns : [columns];
		columnArray.forEach((col) => this.#validateIdentifier(col));

		this.#query.groupBy = columnArray.map((col) => this.#escapeIdentifier(col));
		return this;
	}

	/**
	 * 设置查询限制数量
	 * @param {number} number - 限制数量
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 number 不是正整数时抛出错误
	 * @example
	 * sql.limit(10); // 限制返回10条记录
	 */
	limit(number) {
		if (!Number.isInteger(number) || number <= 0) {
			throw new Error("Limit must be a positive integer");
		}
		this.#query.limit = number;
		return this;
	}

	/**
	 * 设置查询偏移量
	 * @param {number} number - 偏移量
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 number 不是非负整数时抛出错误
	 * @example
	 * sql.offset(20); // 跳过前20条记录
	 */
	offset(number) {
		if (!Number.isInteger(number) || number < 0) {
			throw new Error("Offset must be a non-negative integer");
		}
		this.#query.offset = number;
		return this;
	}

	/**
	 * 启用总数统计（用于分页查询）
	 * 在 SELECT 查询中添加 COUNT(*) OVER() 窗口函数来获取总数
	 * @param {boolean} [enabled=true] - 是否启用总数统计
	 * @returns {SQLBuilder}
	 * @example
	 * // 基本用法
	 * const { sql, params } = sqlBuilder
	 *   .select('*')
	 *   .from('users')
	 *   .withTotal('total_count')
	 *   .limit(10)
	 *   .build();
	 *
	 * // 分页查询示例
	 * const page = 1;
	 * const pageSize = 10;
	 * const { sql, params } = sqlBuilder
	 *   .select(['id', 'name', 'email'])
	 *   .from('users')
	 *   .where('status', 'active')
	 *   .withTotal('total_count')
	 *   .limit(pageSize)
	 *   .offset((page - 1) * pageSize)
	 *   .build();
	 */
	withTotal(fieldName = "__total_count") {
		this.#query.withTotal = fieldName;
		return this;
	}

	/**
	 * 构建 INSERT 查询
	 * @param {string} table - 表名
	 * @param {Object} data - 要插入的数据对象
	 * @returns {SQLBuilder}
	 * @example
	 * sql.insert('users', { name: 'John', age: 25, email: 'john@example.com' });
	 */
	insert(table, data) {
		this.#validateIdentifier(table);

		// 转义所有列名
		const escapedData = {};
		Object.keys(data).forEach((key) => {
			this.#validateIdentifier(key);
			escapedData[this.#escapeIdentifier(key)] = data[key];
		});

		this.#query.type = "INSERT";
		this.#query.table = this.#escapeIdentifier(table);
		this.#query.values = escapedData;
		this.#params.push(...Object.values(data));
		return this;
	}

	/**
	 * 构建 UPDATE 查询
	 * @param {string} table - 表名
	 * @param {Object} data - 要更新的数据对象
	 * @returns {SQLBuilder}
	 * @example
	 * sql.update('users', { name: 'Jane', age: 26 }).where('id', 1);
	 */
	update(table, data) {
		this.#validateIdentifier(table);

		// 转义所有列名
		const escapedData = {};
		Object.keys(data).forEach((key) => {
			this.#validateIdentifier(key);
			escapedData[this.#escapeIdentifier(key)] = data[key];
		});

		this.#query.type = "UPDATE";
		this.#query.table = this.#escapeIdentifier(table);
		this.#query.set = escapedData;
		this.#params.push(...Object.values(data));
		return this;
	}

	/**
	 * 构建 DELETE 查询
	 * @param {string} [table] - 表名（可选）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.delete('users').where('status', 'inactive');
	 * sql.delete().from('users').where('id', 1); // 链式调用方式
	 */
	delete(table = null) {
		this.#query.type = "DELETE";
		if (table) {
			this.#validateIdentifier(table);
			this.#query.table = this.#escapeIdentifier(table);
		}
		return this;
	}

	/**
	 * 构建 SQL 查询对象
	 * @returns {{sql: string, params: any[]}} 包含 SQL 语句和参数的对象
	 * @throws {Error} 当表名为空或查询类型不支持时抛出错误
	 * @example
	 * const { sql, params } = sqlBuilder.build();
	 * console.log(sql); // "SELECT * FROM `users` WHERE `age` > ?"
	 * console.log(params); // [18]
	 */
	build() {
		if (!this.#query.table) {
			throw new Error("Table name is required");
		}

		// 安全验证
		this.#validateFinalQuery();

		switch (this.#query.type) {
			case "SELECT":
				return this.#buildSelect();
			case "INSERT":
				return this.#buildInsert();
			case "UPDATE":
				return this.#buildUpdate();
			case "DELETE":
				return this.#buildDelete();
			default:
				throw new Error(`Unsupported query type: ${this.#query.type}`);
		}
	}

	/**
	 * 最终查询安全验证
	 * @private
	 * @throws {Error} 当查询不安全时抛出错误
	 */
	#validateFinalQuery() {
		// 防止没有 WHERE 条件的 UPDATE 和 DELETE（安全措施）
		if ((this.#query.type === "UPDATE" || this.#query.type === "DELETE") && this.#query.where.length === 0) {
			throw new Error(`Safety check: ${this.#query.type} query requires WHERE clause to prevent accidental data loss`);
		}
	}

	/**
	 * 构建 SELECT 查询
	 * @private
	 * @returns {{sql: string, params: any[]}}
	 */
	#buildSelect() {
		const parts = [];

		// SELECT 部分（处理总数统计）
		const columns = [...this.#query.columns];
		if (this.#query.withTotal) {
			columns.push(`COUNT(*) OVER() AS ${this.#query.withTotal}`);
		}
		parts.push(`SELECT ${columns.join(", ")}`);

		// FROM 部分（处理表别名）
		const fromTable = this.#query.tableAlias ? `${this.#query.table} ${this.#query.tableAlias}` : this.#query.table;
		parts.push(`FROM ${fromTable}`);

		// JOIN 部分
		if (this.#query.joins.length > 0) {
			this.#query.joins.forEach((join) => {
				parts.push(
					`${join.type} JOIN ${join.table} ON ${join.condition.first} ${join.condition.operator} ${join.condition.second}`
				);
			});
		}

		// WHERE 部分
		if (this.#query.where.length > 0) {
			const whereClauses = this.#query.where.map((condition, index) => {
				const connector = index === 0 ? "WHERE" : condition.connector;
				const valuePlaceholder =
					condition.operator === "IS" || condition.operator === "IS NOT"
						? "NULL"
						: condition.operator === "IN" || condition.operator === "NOT IN" || condition.operator === "BETWEEN"
						? condition.value
						: "?";
				return `${connector} ${condition.column} ${condition.operator} ${valuePlaceholder}`;
			});
			parts.push(whereClauses.join(" "));
		}

		// GROUP BY 部分
		if (this.#query.groupBy.length > 0) {
			parts.push(`GROUP BY ${this.#query.groupBy.join(", ")}`);
		}

		// ORDER BY 部分
		if (this.#query.orderBy.length > 0) {
			const orderClauses = this.#query.orderBy.map((order) => `${order.column} ${order.direction}`);
			parts.push(`ORDER BY ${orderClauses.join(", ")}`);
		}

		// LIMIT 和 OFFSET 部分
		if (this.#query.limit !== null) {
			parts.push(`LIMIT ${this.#query.limit}`);
		}

		if (this.#query.offset !== null) {
			parts.push(`OFFSET ${this.#query.offset}`);
		}

		return {
			sql: parts.join(" "),
			params: [...this.#params],
		};
	}

	/**
	 * 构建 INSERT 查询
	 * @private
	 * @returns {{sql: string, params: any[]}}
	 */
	#buildInsert() {
		const columns = Object.keys(this.#query.values);
		const placeholders = columns.map(() => "?").join(", ");

		const sql = `INSERT INTO ${this.#query.table} (${columns.join(", ")}) VALUES (${placeholders})`;

		return {
			sql,
			params: [...this.#params],
		};
	}

	/**
	 * 构建 UPDATE 查询
	 * @private
	 * @returns {{sql: string, params: any[]}}
	 */
	#buildUpdate() {
		const setClauses = Object.keys(this.#query.set)
			.map((column) => `${column} = ?`)
			.join(", ");

		const parts = [`UPDATE ${this.#query.table} SET ${setClauses}`];

		// WHERE 部分
		if (this.#query.where.length > 0) {
			const whereClauses = this.#query.where.map((condition, index) => {
				const connector = index === 0 ? "WHERE" : condition.connector;
				const valuePlaceholder = condition.operator === "IS" || condition.operator === "IS NOT" ? "NULL" : "?";
				return `${connector} ${condition.column} ${condition.operator} ${valuePlaceholder}`;
			});
			parts.push(whereClauses.join(" "));
		}

		return {
			sql: parts.join(" "),
			params: [...this.#params],
		};
	}

	/**
	 * 构建 DELETE 查询
	 * @private
	 * @returns {{sql: string, params: any[]}}
	 */
	#buildDelete() {
		const parts = [`DELETE FROM ${this.#query.table}`];

		// WHERE 部分
		if (this.#query.where.length > 0) {
			const whereClauses = this.#query.where.map((condition, index) => {
				const connector = index === 0 ? "WHERE" : condition.connector;
				const valuePlaceholder = condition.operator === "IS" || condition.operator === "IS NOT" ? "NULL" : "?";
				return `${connector} ${condition.column} ${condition.operator} ${valuePlaceholder}`;
			});
			parts.push(whereClauses.join(" "));
		}

		return {
			sql: parts.join(" "),
			params: [...this.#params],
		};
	}

	/**
	 * 获取格式化的 SQL 字符串（用于调试，不应用于实际查询）
	 * @returns {string} 格式化的 SQL 字符串
	 * @example
	 * console.log(sqlBuilder.toString());
	 * // "SELECT * FROM `users` WHERE `age` > 18 AND `status` = 'active'"
	 */
	toString() {
		const { sql, params } = this.build();
		return this.#formatSQL(sql, params);
	}

	/**
	 * 格式化 SQL 字符串，将参数替换到 SQL 中（仅用于调试）
	 * @private
	 * @param {string} sql - SQL 语句
	 * @param {any[]} params - 参数数组
	 * @returns {string} 格式化后的 SQL 字符串
	 */
	#formatSQL(sql, params) {
		let formattedSQL = sql;
		let paramIndex = 0;

		// 安全地替换参数
		formattedSQL = formattedSQL.replace(/\?/g, () => {
			if (paramIndex >= params.length) return "?";
			const param = params[paramIndex++];
			return typeof param === "string" ? `'${param.replace(/'/g, "''")}'` : param;
		});

		return formattedSQL;
	}

	/**
	 * 获取当前查询的参数数组
	 * @returns {any[]} 参数数组
	 * @example
	 * const params = sqlBuilder.getParams();
	 */
	getParams() {
		return [...this.#params];
	}

	/**
	 * 获取当前查询的 SQL 字符串（未构建）
	 * @returns {string} 当前查询类型的描述
	 * @example
	 * console.log(sqlBuilder.getQueryType()); // "SELECT"
	 */
	getQueryType() {
		return this.#query.type;
	}
}

export { SQLBuilder };
export default SQLBuilder;
