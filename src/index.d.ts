/**
 * SQL 构建结果
 * 包含生成的 SQL 语句和参数，toString() 方法将参数安全地内联到 SQL 中（仅用于调试）
 * @example
 * ```typescript
 * const result = sqlBuilder.select('*').from('users').where('age', '>', 18).build();
 * console.log(result.sql);         // SELECT * FROM `users` WHERE `age` > ?
 * console.log(result.params);      // [18]
 * console.log(result.toString());  // SELECT * FROM `users` WHERE `age` > 18
 * // 解构仍然有效
 * const { sql, params } = result;
 * ```
 */
declare class BuildResult {
	/** 生成的 SQL 语句（含占位符 ?） */
	readonly sql: string;
	/** 查询参数数组 */
	readonly params: any[];
	/**
	 * @param sql - 生成的 SQL 语句
	 * @param params - 查询参数数组
	 */
	constructor(sql: string, params: any[]);
	/**
	 * 返回将参数安全地内联后的完整 SQL 字符串（仅用于调试，不应用于实际查询）
	 * 字符串参数会被单引号包裹，并对内部单引号进行转义，防止 SQL 注入
	 * @returns 格式化的 SQL 字符串
	 */
	toString(): string;
}

/**
 * 原始 SQL 表达式包装器，用于在 UPDATE 语句中嵌入不参数化的表达式
 * @example
 * ```typescript
 * sqlBuilder.update('users', { age: raw('age + 1') }).where('id', 1);
 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
 * ```
 */
declare class RawExpression {
	/** 原始 SQL 表达式字符串 */
	readonly expression: string;
	/**
	 * @param expression - 原始 SQL 表达式（不会被参数化，请勿传入用户输入）
	 */
	constructor(expression: string);
}

/**
 * 创建一个原始 SQL 表达式，用于在 UPDATE 语句中嵌入不参数化的列表达式。
 * 注意：表达式会直接嵌入 SQL，请勿将用户输入传入此函数。
 * @param expression - 原始 SQL 表达式
 * @returns RawExpression 实例
 * @example
 * ```typescript
 * sqlBuilder.update('users', { age: raw('age + 1') }).where('id', 1);
 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
 * ```
 */
declare function raw(expression: string): RawExpression;

/**
 * JOIN ON 条件构建器，用于构建复杂的 ON 条件（多个 AND/OR 子条件）
 * @example
 * ```typescript
 * sql.join('posts', (on) => {
 *   on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status');
 * });
 * ```
 */
declare class JoinClause {
	/**
	 * 添加一个 AND ON 条件
	 * @param first - 第一个连接条件列
	 * @param operator - 操作符
	 * @param second - 第二个连接条件列
	 * @returns JoinClause 实例（支持链式调用）
	 * @example
	 * ```typescript
	 * on.on('users.id', '=', 'posts.user_id')
	 * ```
	 */
	on(first: string, operator: string, second: string): this;

	/**
	 * 添加一个 OR ON 条件
	 * @param first - 第一个连接条件列
	 * @param operator - 操作符
	 * @param second - 第二个连接条件列
	 * @returns JoinClause 实例（支持链式调用）
	 * @example
	 * ```typescript
	 * on.on('users.id', '=', 'posts.user_id').orOn('users.uuid', '=', 'posts.user_uuid')
	 * ```
	 */
	orOn(first: string, operator: string, second: string): this;
}

/**
 * 安全的 SQL 查询构建器
 * 提供全面的 SQL 注入防护，使用参数化查询和标识符验证
 * @example
 * ```typescript
 * const sql = new SQLBuilder();
 * const query = sql.select('*').from('users').where('age', '>', 18).build();
 * console.log(query.sql); // SELECT * FROM `users` WHERE `age` > ?
 * console.log(query.params); // [18]
 * ```
 */
declare class SQLBuilder {
	/**
	 * 创建 SQLBuilder 实例
	 * @example
	 * ```typescript
	 * const sql = new SQLBuilder();
	 * ```
	 */
	constructor();

	/**
	 * 设置标识符白名单
	 * @param identifiers - 允许的标识符列表
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.setAllowedIdentifiers(['users', 'id', 'name', 'email']);
	 * ```
	 */
	setAllowedIdentifiers(identifiers: string[]): this;

	/**
	 * 重置构建器状态
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.reset().select('*').from('users');
	 * ```
	 */
	reset(): this;

	/**
	 * 设置 SELECT 查询的列
	 * @param columns - 要查询的列名或原始 SQL 表达式，默认为 ['*']
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('id', 'name');
	 * sql.select(['id', 'name', 'email']);
	 * sql.select('*'); // 查询所有列
	 * sql.select(raw('COALESCE(name, email) AS display_name')); // 原始表达式
	 * sql.select(['id', raw('COALESCE(name, email) AS display_name')]); // 混合使用
	 * ```
	 */
	select(columns?: string | RawExpression | Array<string | RawExpression>): this;

	/**
	 * 启用 SELECT DISTINCT 去重查询
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('name').distinct().from('users');
	 * // SELECT DISTINCT `name` FROM `users`
	 * ```
	 */
	distinct(): this;

	/**
	 * 设置查询的表名
	 * @param table - 表名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.from('users');
	 * sql.from('users u'); // 使用表别名
	 * ```
	 */
	from(table: string): this;

	/**
	 * 添加 WHERE 条件（分组回调形式，生成括号嵌套）
	 * @param callback - 分组回调，接收子构建器以定义括号内的条件
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('age', '>', 18).where(q => q.where('status', 'active').orWhere('status', 'pending'));
	 * // WHERE `age` > ? AND (`status` = ? OR `status` = ?)
	 * ```
	 */
	where(callback: (builder: SQLBuilder) => void): this;

	/**
	 * 添加 WHERE 条件
	 * @param column - 列名
	 * @param operator - 操作符，默认为 '='
	 * @param value - 值（当只有两个参数时，第二个参数作为值）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('age', '>', 18);
	 * sql.where('name', 'John'); // 默认使用 = 操作符
	 * sql.where('status', 'IS', null);
	 * ```
	 */
	where(column: string, operator: string, value?: any): this;

	/**
	 * 添加 OR WHERE 条件（分组回调形式，生成括号嵌套）
	 * @param callback - 分组回调，接收子构建器以定义括号内的条件
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('type', 'vip').orWhere(q => q.where('age', '>', 60).where('member', true));
	 * // WHERE `type` = ? OR (`age` > ? AND `member` = ?)
	 * ```
	 */
	orWhere(callback: (builder: SQLBuilder) => void): this;

	/**
	 * 添加 OR WHERE 条件
	 * @param column - 列名
	 * @param operator - 操作符，默认为 '='
	 * @param value - 值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('status', 'active').orWhere('status', 'pending');
	 * ```
	 */
	orWhere(column: string, operator: string, value?: any): this;

	/**
	 * 添加 WHERE IN 条件
	 * @param column - 列名
	 * @param values - 值数组
	 * @returns SQLBuilder 实例
	 * @throws 当 values 不是数组或为空时抛出错误
	 * @example
	 * ```typescript
	 * sql.whereIn('status', ['active', 'pending', 'inactive']);
	 * ```
	 */
	whereIn(column: string, values: any[]): this;

	/**
	 * 添加 WHERE NOT IN 条件
	 * @param column - 列名
	 * @param values - 值数组
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereNotIn('role', ['admin', 'superuser']);
	 * ```
	 */
	whereNotIn(column: string, values: any[]): this;

	/**
	 * 添加 LIKE 条件，自动在值两侧添加 % 通配符
	 * @param column - 列名
	 * @param value - 搜索值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereLike('name', 'John'); // 搜索包含 'John' 的名称
	 * ```
	 */
	whereLike(column: string, value: string): this;

	/**
	 * 添加 LIKE 前缀匹配条件（STARTS WITH）
	 * @param column - 列名
	 * @param value - 搜索值（自动追加 %）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereStartsWith('name', 'John'); // 搜索以 'John' 开头的名称
	 * ```
	 */
	whereStartsWith(column: string, value: string): this;

	/**
	 * 添加 LIKE 后缀匹配条件（ENDS WITH）
	 * @param column - 列名
	 * @param value - 搜索值（自动前置 %）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereEndsWith('email', '@example.com'); // 搜索以 '@example.com' 结尾的邮箱
	 * ```
	 */
	whereEndsWith(column: string, value: string): this;

	/**
	 * 添加 BETWEEN 条件
	 * @param column - 列名
	 * @param start - 范围开始值
	 * @param end - 范围结束值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereBetween('age', 18, 65);
	 * sql.whereBetween('created_at', '2023-01-01', '2023-12-31');
	 * ```
	 */
	whereBetween(column: string, start: any, end: any): this;

	/**
	 * 添加 IS NULL 条件
	 * @param column - 列名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereNull('deleted_at');
	 * ```
	 */
	whereNull(column: string): this;

	/**
	 * 添加 IS NOT NULL 条件
	 * @param column - 列名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereNotNull('email');
	 * ```
	 */
	whereNotNull(column: string): this;

	/**
	 * 添加 OR WHERE IN 条件
	 * @param column - 列名
	 * @param values - 值数组
	 * @returns SQLBuilder 实例
	 * @throws 当 values 不是数组或为空时抛出错误
	 * @example
	 * ```typescript
	 * sql.where('type', 'vip').orWhereIn('status', ['active', 'pending']);
	 * ```
	 */
	orWhereIn(column: string, values: any[]): this;

	/**
	 * 添加 OR WHERE NOT IN 条件
	 * @param column - 列名
	 * @param values - 值数组
	 * @returns SQLBuilder 实例
	 * @throws 当 values 不是数组或为空时抛出错误
	 * @example
	 * ```typescript
	 * sql.where('type', 'vip').orWhereNotIn('role', ['admin', 'superuser']);
	 * ```
	 */
	orWhereNotIn(column: string, values: any[]): this;

	/**
	 * 添加 OR LIKE 条件，自动在值两侧添加 % 通配符
	 * @param column - 列名
	 * @param value - 搜索值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereLike('name', 'John').orWhereLike('name', 'Jane');
	 * ```
	 */
	orWhereLike(column: string, value: string): this;

	/**
	 * 添加 OR LIKE 前缀匹配条件（OR STARTS WITH）
	 * @param column - 列名
	 * @param value - 搜索值（自动追加 %）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereStartsWith('name', 'John').orWhereStartsWith('name', 'Jane');
	 * ```
	 */
	orWhereStartsWith(column: string, value: string): this;

	/**
	 * 添加 OR LIKE 后缀匹配条件（OR ENDS WITH）
	 * @param column - 列名
	 * @param value - 搜索值（自动前置 %）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereEndsWith('email', '@example.com').orWhereEndsWith('email', '@test.com');
	 * ```
	 */
	orWhereEndsWith(column: string, value: string): this;

	/**
	 * 添加 OR BETWEEN 条件
	 * @param column - 列名
	 * @param start - 范围开始值
	 * @param end - 范围结束值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereBetween('age', 0, 17).orWhereBetween('age', 66, 100);
	 * ```
	 */
	orWhereBetween(column: string, start: any, end: any): this;

	/**
	 * 添加 OR IS NULL 条件
	 * @param column - 列名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereNull('deleted_at').orWhereNull('archived_at');
	 * ```
	 */
	orWhereNull(column: string): this;

	/**
	 * 添加 OR IS NOT NULL 条件
	 * @param column - 列名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereNotNull('email').orWhereNotNull('phone');
	 * ```
	 */
	orWhereNotNull(column: string): this;

	/**
	 * 添加原始 WHERE 条件（高级用户逃生通道）
	 * @param expression - 原始 SQL 条件表达式（不会被转义，请勿传入用户输入）
	 * @param params - 与表达式中占位符对应的参数数组
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereRaw('age > 18');
	 * sql.whereRaw('age > ? AND age < ?', [18, 65]);
	 * sql.whereRaw('JSON_CONTAINS(tags, ?)', ['"admin"']);
	 * ```
	 */
	whereRaw(expression: string, params?: any[]): this;

	/**
	 * 添加原始 OR WHERE 条件（高级用户逃生通道）
	 * @param expression - 原始 SQL 条件表达式（不会被转义，请勿传入用户输入）
	 * @param params - 与表达式中占位符对应的参数数组
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('status', 'active').orWhereRaw('age > 60');
	 * sql.orWhereRaw('score BETWEEN ? AND ?', [80, 100]);
	 * ```
	 */
	orWhereRaw(expression: string, params?: any[]): this;

	/**
	 * 添加 WHERE EXISTS 子查询存在性判断（AND 连接）
	 * @param subquery - 子查询 SQLBuilder 实例
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('*').from('users')
	 *   .whereExists(new SQLBuilder().select('*').from('orders').whereRaw('orders.user_id = users.id'));
	 * // SELECT * FROM `users` WHERE EXISTS (SELECT * FROM `orders` WHERE orders.user_id = users.id)
	 * ```
	 */
	whereExists(subquery: SQLBuilder): this;

	/**
	 * 添加 WHERE NOT EXISTS 子查询存在性判断（AND 连接）
	 * @param subquery - 子查询 SQLBuilder 实例
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('*').from('users')
	 *   .whereNotExists(new SQLBuilder().select('*').from('bans').whereRaw('bans.user_id = users.id'));
	 * // SELECT * FROM `users` WHERE NOT EXISTS (SELECT * FROM `bans` WHERE bans.user_id = users.id)
	 * ```
	 */
	whereNotExists(subquery: SQLBuilder): this;

	/**
	 * 添加 OR WHERE EXISTS 子查询存在性判断（OR 连接）
	 * @param subquery - 子查询 SQLBuilder 实例
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('*').from('users')
	 *   .where('status', 'vip')
	 *   .orWhereExists(new SQLBuilder().select('*').from('orders').whereRaw('orders.user_id = users.id'));
	 * // SELECT * FROM `users` WHERE `status` = ? OR EXISTS (SELECT * FROM `orders` WHERE orders.user_id = users.id)
	 * ```
	 */
	orWhereExists(subquery: SQLBuilder): this;

	/**
	 * 添加 OR WHERE NOT EXISTS 子查询存在性判断（OR 连接）
	 * @param subquery - 子查询 SQLBuilder 实例
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('*').from('users')
	 *   .where('status', 'vip')
	 *   .orWhereNotExists(new SQLBuilder().select('*').from('bans').whereRaw('bans.user_id = users.id'));
	 * // SELECT * FROM `users` WHERE `status` = ? OR NOT EXISTS (SELECT * FROM `bans` WHERE bans.user_id = users.id)
	 * ```
	 */
	orWhereNotExists(subquery: SQLBuilder): this;

	/**
	 * 添加 INNER JOIN 连接
	 * @param table - 要连接的表名
	 * @param callback - 接收 JoinClause 的回调函数，用于构建复杂 ON 条件
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.join('posts', (on) => on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status'));
	 * ```
	 */
	join(table: string, callback: (on: JoinClause) => void): this;

	/**
	 * 添加 INNER JOIN 连接
	 * @param table - 要连接的表名
	 * @param first - 第一个连接条件列
	 * @param operator - 操作符
	 * @param second - 第二个连接条件列
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.join('posts', 'users.id', '=', 'posts.user_id');
	 * ```
	 */
	join(table: string, first: string, operator: string, second: string): this;

	/**
	 * 添加 LEFT JOIN 连接
	 * @param table - 要连接的表名
	 * @param callback - 接收 JoinClause 的回调函数，用于构建复杂 ON 条件
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.leftJoin('posts', (on) => on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status'));
	 * ```
	 */
	leftJoin(table: string, callback: (on: JoinClause) => void): this;

	/**
	 * 添加 LEFT JOIN 连接
	 * @param table - 要连接的表名
	 * @param first - 第一个连接条件列
	 * @param operator - 操作符
	 * @param second - 第二个连接条件列
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.leftJoin('profiles', 'users.id', '=', 'profiles.user_id');
	 * ```
	 */
	leftJoin(table: string, first: string, operator: string, second: string): this;

	/**
	 * 添加 RIGHT JOIN 连接
	 * @param table - 要连接的表名
	 * @param callback - 接收 JoinClause 的回调函数，用于构建复杂 ON 条件
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.rightJoin('posts', (on) => on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status'));
	 * ```
	 */
	rightJoin(table: string, callback: (on: JoinClause) => void): this;

	/**
	 * 添加 RIGHT JOIN 连接
	 * @param table - 要连接的表名
	 * @param first - 第一个连接条件列
	 * @param operator - 操作符
	 * @param second - 第二个连接条件列
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.rightJoin('profiles', 'users.id', '=', 'profiles.user_id');
	 * ```
	 */
	rightJoin(table: string, first: string, operator: string, second: string): this;

	/**
	 * 添加 FULL OUTER JOIN 连接
	 * @param table - 要连接的表名
	 * @param callback - 接收 JoinClause 的回调函数，用于构建复杂 ON 条件
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.fullJoin('posts', (on) => on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status'));
	 * ```
	 */
	fullJoin(table: string, callback: (on: JoinClause) => void): this;

	/**
	 * 添加 FULL OUTER JOIN 连接
	 * @param table - 要连接的表名
	 * @param first - 第一个连接条件列
	 * @param operator - 操作符
	 * @param second - 第二个连接条件列
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.fullJoin('profiles', 'users.id', '=', 'profiles.user_id');
	 * ```
	 */
	fullJoin(table: string, first: string, operator: string, second: string): this;

	/**
	 * 添加 CROSS JOIN 连接
	 * @param table - 要连接的表名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.crossJoin('products');
	 * ```
	 */
	crossJoin(table: string): this;

	/**
	 * 添加排序条件
	 * @param column - 排序列名
	 * @param direction - 排序方向，默认为 'ASC'
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.orderBy('created_at', 'DESC');
	 * sql.orderBy('name', 'ASC');
	 * ```
	 */
	orderBy(column: string, direction?: "ASC" | "DESC"): this;

	/**
	 * 添加分组条件
	 * @param columns - 分组列名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.groupBy('category');
	 * sql.groupBy(['category', 'status']);
	 * ```
	 */
	groupBy(columns: string | string[]): this;

	/**
	 * 添加 HAVING 条件
	 * @param column - 列名或聚合表达式（例如 'COUNT(*)'）
	 * @param operator - 比较操作符
	 * @param value - 比较值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.groupBy('category').having('COUNT(*)', '>', 5);
	 * sql.groupBy('status').having('SUM(amount)', '>=', 1000);
	 * ```
	 */
	having(column: string, operator: string, value: any): this;

	/**
	 * 添加原始 HAVING 条件（高级用户逃生通道）
	 * 注意：表达式会直接嵌入 SQL，请勿将用户输入传入 expression 参数。
	 * @param expression - 原始 SQL 条件表达式
	 * @param params - 与表达式中占位符对应的参数数组
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.groupBy('category').havingRaw('COUNT(*) > 5');
	 * sql.groupBy('status').havingRaw('SUM(amount) > ?', [1000]);
	 * ```
	 */
	havingRaw(expression: string, params?: any[]): this;

	/**
	 * 统计总数
	 * @param fieldName - 统计出来之后的字段名称
	 */
	withTotal(fieldName: string): this;

	/**
	 * 设置查询限制数量
	 * @param number - 限制数量
	 * @returns SQLBuilder 实例
	 * @throws 当 number 不是正整数时抛出错误
	 * @example
	 * ```typescript
	 * sql.limit(10); // 限制返回10条记录
	 * ```
	 */
	limit(number: number): this;

	/**
	 * 设置查询偏移量
	 * @param number - 偏移量
	 * @returns SQLBuilder 实例
	 * @throws 当 number 不是非负整数时抛出错误
	 * @example
	 * ```typescript
	 * sql.offset(20); // 跳过前20条记录
	 * ```
	 */
	offset(number: number): this;

	/**
	 * 构建 UPSERT 查询（INSERT ... ON DUPLICATE KEY UPDATE）
	 * 适用于 MySQL / MariaDB。
	 * 注意：使用 VALUES(col) 语法的字符串数组和默认模式在 MySQL 8.0.20+ 中已弃用；
	 * 对于 MySQL 9.0+，请改用显式更新数据对象（第三个参数传入对象）。
	 * @param table - 表名
	 * @param insertData - 要插入的数据对象
	 * @param updateData - 冲突时要更新的列名数组，或显式更新数据对象（值可以是普通值或 RawExpression）。
	 *   若为字符串数组，则使用 VALUES(col) 引用插入值；
	 *   若为对象，则使用对象中指定的值（支持 RawExpression）；
	 *   若省略，则更新 insertData 中的所有列（使用 VALUES(col)）。
	 * @returns SQLBuilder 实例
	 * @throws 当 insertData 为空对象时抛出错误
	 * @example
	 * ```typescript
	 * // 更新所有插入列（使用 VALUES(col)）
	 * sql.upsert('users', { name: 'John', email: 'john@example.com' });
	 * // INSERT INTO `users` (`name`, `email`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `email` = VALUES(`email`)
	 *
	 * // 只更新指定列
	 * sql.upsert('users', { name: 'John', email: 'john@example.com' }, ['name']);
	 * // INSERT INTO `users` (`name`, `email`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)
	 *
	 * // 使用显式更新数据（推荐用于 MySQL 8.0.20+）
	 * sql.upsert('users', { name: 'John', email: 'john@example.com' }, { name: 'John Updated' });
	 * // INSERT INTO `users` (`name`, `email`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = ?
	 * ```
	 */
	upsert(table: string, insertData: Record<string, any>, updateData?: string[] | Record<string, any | RawExpression>): this;

	/**
	 * 构建 INSERT 查询
	 * @param table - 表名
	 * @param data - 要插入的数据对象，或数据对象数组（批量插入）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.insert('users', { name: 'John', age: 25, email: 'john@example.com' });
	 * sql.insert('users', [{ name: 'John', age: 25 }, { name: 'Jane', age: 30 }]);
	 * ```
	 */
	insert(table: string, data: Record<string, any> | Record<string, any>[]): this;

	/**
	 * 构建 UPDATE 查询，设置目标表
	 * @param table - 表名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.update('users').set({ name: 'Jane', age: 26 }).where('id', 1);
	 * sql.update('users').set({ age: raw('age + 1') }).where('id', 1);
	 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
	 * ```
	 */
	update(table: string): this;

	/**
	 * 设置 UPDATE 查询的更新数据
	 * @param data - 要更新的数据对象（值可以是普通值或 RawExpression）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.update('users').set({ name: 'Jane', age: 26 }).where('id', 1);
	 * sql.update('users').set({ age: raw('age + 1') }).where('id', 1);
	 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
	 * ```
	 */
	set(data: Record<string, any | RawExpression>): this;

	/**
	 * 设置 UPDATE 查询的更新数据（单列简写形式）
	 * @param column - 要更新的列名
	 * @param value - 列的值（普通值或 RawExpression）；如需嵌入原始 SQL 表达式，请传入 raw() 的返回值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.update('users').set('age', 26).where('id', 1);
	 * // UPDATE `users` SET `age` = ? WHERE `id` = ?
	 * sql.update('users').set('age', raw('age + 1')).where('id', 1);
	 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
	 * ```
	 */
	set(column: string, value: any | RawExpression): this;

	/**
	 * 为 SELECT 查询添加行级锁定子句
	 * @param mode - 锁定模式
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('*').from('users').where('id', 1).lock('FOR UPDATE');
	 * // SELECT * FROM `users` WHERE `id` = ? FOR UPDATE
	 * ```
	 */
	lock(mode: "FOR UPDATE" | "FOR SHARE" | "LOCK IN SHARE MODE"): this;

	/**
	 * 添加 UNION 子句，合并另一个 SELECT 查询的结果（去重）
	 * @param builder - 另一个 SQLBuilder 实例
	 * @returns SQLBuilder 实例
	 * @throws 当 builder 不是 SQLBuilder 实例时抛出错误
	 * @example
	 * ```typescript
	 * sql.select('id', 'name').from('users').union(
	 *   new SQLBuilder().select('id', 'name').from('admins')
	 * );
	 * // SELECT `id`, `name` FROM `users` UNION SELECT `id`, `name` FROM `admins`
	 * ```
	 */
	union(builder: SQLBuilder): this;

	/**
	 * 添加 UNION ALL 子句，合并另一个 SELECT 查询的结果（保留重复行）
	 * @param builder - 另一个 SQLBuilder 实例
	 * @returns SQLBuilder 实例
	 * @throws 当 builder 不是 SQLBuilder 实例时抛出错误
	 * @example
	 * ```typescript
	 * sql.select('id', 'name').from('users').unionAll(
	 *   new SQLBuilder().select('id', 'name').from('admins')
	 * );
	 * // SELECT `id`, `name` FROM `users` UNION ALL SELECT `id`, `name` FROM `admins`
	 * ```
	 */
	unionAll(builder: SQLBuilder): this;

	/**
	 * 为 INSERT/UPDATE/DELETE 查询添加 RETURNING 子句，指定返回的列
	 * @param columns - 要返回的列名，传入 '*' 返回所有列
	 * @returns SQLBuilder 实例
	 * @throws 当列名格式非法时抛出错误
	 * @example
	 * ```typescript
	 * sql.insert('users', { name: 'John' }).returning('id', 'name');
	 * // INSERT INTO `users` (`name`) VALUES (?) RETURNING `id`, `name`
	 * sql.update('users').set({ name: 'Jane' }).where('id', 1).returning('*');
	 * // UPDATE `users` SET `name` = ? WHERE `id` = ? RETURNING *
	 * sql.delete('users').where('id', 1).returning('id');
	 * // DELETE FROM `users` WHERE `id` = ? RETURNING `id`
	 * ```
	 */
	returning(...columns: string[]): this;

	/**
	 * 构建 DELETE 查询
	 * @param table - 表名（可选）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.delete('users').where('status', 'inactive');
	 * sql.delete().from('users').where('id', 1); // 链式调用方式
	 * ```
	 */
	delete(table?: string): this;

	/**
	 * 构建 SQL 查询对象
	 * @returns BuildResult 对象，包含 sql、params 属性，toString() 返回内联参数后的完整 SQL
	 * @throws 当表名为空或查询类型不支持时抛出错误
	 * @example
	 * ```typescript
	 * const result = sqlBuilder.build();
	 * console.log(result.sql);         // "SELECT * FROM `users` WHERE `age` > ?"
	 * console.log(result.params);      // [18]
	 * console.log(result.toString());  // "SELECT * FROM `users` WHERE `age` > 18"
	 * // 解构仍然有效
	 * const { sql, params } = sqlBuilder.build();
	 * ```
	 */
	build(): BuildResult;

	/**
	 * 获取格式化的 SQL 字符串（用于调试，不应用于实际查询）
	 * @returns 格式化的 SQL 字符串
	 * @example
	 * ```typescript
	 * console.log(sqlBuilder.toString());
	 * // "SELECT * FROM `users` WHERE `age` > 18 AND `status` = 'active'"
	 * ```
	 */
	toString(): string;

	/**
	 * 获取当前查询的参数数组
	 * @returns 参数数组
	 * @example
	 * ```typescript
	 * const params = sqlBuilder.getParams();
	 * ```
	 */
	getParams(): any[];

	/**
	 * 获取当前查询的 SQL 字符串（未构建）
	 * @returns 当前查询类型的描述
	 * @example
	 * ```typescript
	 * console.log(sqlBuilder.getQueryType()); // "SELECT"
	 * ```
	 */
	getQueryType(): string;
}

/**
 * SQL 事务构建器
 * 将多个 SQLBuilder 查询包装在事务中，支持 SAVEPOINT 操作
 * @example
 * ```typescript
 * const transaction = new Transaction();
 * const result = transaction
 *   .add(new SQLBuilder().insert('users', { name: 'John' }))
 *   .add(new SQLBuilder().update('accounts').set({ balance: 100 }).where('id', 1))
 *   .build();
 * // result.sql:
 * // BEGIN;
 * // INSERT INTO `users` (`name`) VALUES (?);
 * // UPDATE `accounts` SET `balance` = ? WHERE `id` = ?;
 * // COMMIT;
 * ```
 */
declare class Transaction {
	/**
	 * 创建 Transaction 实例
	 * @param type - 事务类型，可选值为 DEFERRED、IMMEDIATE、EXCLUSIVE
	 * @throws 当类型不合法时抛出错误
	 * @example
	 * ```typescript
	 * new Transaction('DEFERRED');
	 * new Transaction('IMMEDIATE');
	 * new Transaction('EXCLUSIVE');
	 * ```
	 */
	constructor(type?: "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE");

	/**
	 * 添加一个 SQLBuilder 查询到事务中
	 * @param builder - SQLBuilder 实例
	 * @returns Transaction 实例
	 * @throws 当 builder 不是 SQLBuilder 实例时抛出错误
	 * @example
	 * ```typescript
	 * transaction.add(new SQLBuilder().insert('users', { name: 'John' }));
	 * ```
	 */
	add(builder: SQLBuilder): this;

	/**
	 * 添加 SAVEPOINT 语句
	 * @param name - SAVEPOINT 名称（只允许字母、数字和下划线，且以字母或下划线开头）
	 * @returns Transaction 实例
	 * @example
	 * ```typescript
	 * transaction.savepoint('sp1');
	 * ```
	 */
	savepoint(name: string): this;

	/**
	 * 添加 RELEASE SAVEPOINT 语句
	 * @param name - SAVEPOINT 名称
	 * @returns Transaction 实例
	 * @example
	 * ```typescript
	 * transaction.releaseSavepoint('sp1');
	 * ```
	 */
	releaseSavepoint(name: string): this;

	/**
	 * 添加 ROLLBACK TO SAVEPOINT 语句
	 * @param name - SAVEPOINT 名称
	 * @returns Transaction 实例
	 * @example
	 * ```typescript
	 * transaction.rollbackTo('sp1');
	 * ```
	 */
	rollbackTo(name: string): this;

	/**
	 * 构建事务 SQL
	 * @returns BuildResult 对象，包含完整事务 SQL 语句和参数，toString() 返回内联参数后的完整 SQL
	 * @example
	 * ```typescript
	 * const result = transaction.build();
	 * console.log(result.sql);
	 * // BEGIN;
	 * // INSERT INTO `users` (`name`) VALUES (?);
	 * // COMMIT;
	 * console.log(result.toString());
	 * // BEGIN;
	 * // INSERT INTO `users` (`name`) VALUES ('John');
	 * // COMMIT;
	 * ```
	 */
	build(): BuildResult;
}

export { SQLBuilder, Transaction, RawExpression, BuildResult, JoinClause, raw };
export default SQLBuilder;
