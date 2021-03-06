const db = require('../database');
const authUtils = require('../utils/authUtils');
const authResolvers = require('./resolvers/auth');
const accountResolvers = require('./resolvers/account');
const dataSetResolvers = require('./resolvers/dataSets');

const resolvers = {
	Query: {
		accounts: async (root, args, { token, user }) => {
			authUtils.authenticate(token);

			// TODO inelegant & should be improved. Perhaps log user out? Also the FE code doesn't handle the response
			// properly
			const userRecord = await db.accounts.findByPk(user.accountId);
			if (userRecord.dataValues.accountType !== 'superuser') {
				return {
					success: false,
					errorStatus: 'PermissionDenied'
				};
			}

			const { limit, offset, sortCol, sortDir } = args;
			const { accountId } = user;

			const sortColMap = {
				lastName: 'last_name',
				firstName: 'first_name',
				accountStatus: 'account_status',
				expiryDate: 'date_expires'
			};

			const [results] = await db.sequelize.query(`
				SELECT *
				FROM accounts
				WHERE created_by = ${accountId}
				ORDER BY ${sortColMap[sortCol]} ${sortDir}
				LIMIT ${limit}
				OFFSET ${offset} 
			`);

			const [totalCountQuery] = await db.sequelize.query(`
				SELECT count(*) as c
				FROM accounts
				WHERE created_by = ${accountId} 
			`, { raw: true, type: db.sequelize.QueryTypes.SELECT });

			return {
				totalCount: totalCountQuery.c,
				results: results.map((row) => ({
					accountId: row.account_id,
					dateCreated: row.date_created,
					lastUpdated: row.last_updated,
					lastLoggedIn: row.last_logged_in,
					expiryDate: row.date_expires,
					accountType: row.account_type,
					accountStatus: row.account_status,
					firstName: row.first_name,
					lastName: row.last_name,
					email: row.email,
					country: row.country,
					region: row.region
				}))
			};
		},

		// retrieves any account info
		account: async (root, args, { user, token }) => {
			authUtils.authenticate(token);

			// TODO improve
			const userRecord = await db.accounts.findByPk(user.accountId);
			if (userRecord.dataValues.accountType !== 'superuser') {
				return {
					success: false,
					errorStatus: 'PermissionDenied'
				};
			}

			return db.accounts.findByPk(user.accountId);
		},

		// returns current user's data sets
		dataSets: async (root, args, { token, user }) => {
			const { limit, offset, sortDir, sortCol } = args;

			authUtils.authenticate(token);

			const sortColMap = {
				dataSetName: 'd.dataset_name',
				lastUpdated: 'dsh.date_created'
			};

			const { accountId } = user;
			const [results] = await db.sequelize.query(`
				SELECT d.dataset_name,
				    d.dataset_id AS dataSetId,
				    d.num_rows_generated as numRowsGenerated,
				    dsh.*,
					unix_timestamp(d.date_created) AS dateCreatedUnix,
					unix_timestamp(dsh.date_created) AS historyDateCreatedUnix
				FROM datasets d
				LEFT JOIN dataset_history dsh ON dsh.dataset_id = d.dataset_id
					AND dsh.history_id =
						(SELECT history_id
						 FROM dataset_history dsh2
						 WHERE dsh2.dataset_id = d.dataset_id
						 ORDER BY history_id DESC
						 LIMIT 1)
				WHERE account_id = ${accountId}
				ORDER BY ${sortColMap[sortCol]} ${sortDir}
				LIMIT ${limit}
				OFFSET ${offset}
			`);

			const [totalCountQuery] = await db.sequelize.query(`
				SELECT count(*) as c
				FROM datasets
				WHERE account_id = ${accountId} 
			`, { raw: true, type: db.sequelize.QueryTypes.SELECT });

			return {
				totalCount: totalCountQuery.c,
				results: results.map((row) => ({
					dataSetId: row.dataSetId,
					status: row.status,
					numRowsGenerated: row.numRowsGenerated,
					historyId: row.history_id,
					dataSetName: row.dataset_name,
					content: row.content,
					dataCreatedUnix: row.dateCreatedUnix,
					historyDateCreatedUnix: row.historyDateCreatedUnix
				}))
			};
		},

		dataSetHistory: async (root, args, { token, user }) => {
			const { dataSetId, limit, offset } = args;

			authUtils.authenticate(token);

			// TODO auth
			// const { accountId } = user;

			const [results] = await db.sequelize.query(`
				SELECT *
				FROM dataset_history dh
				WHERE dataset_id = ${dataSetId}
				ORDER BY history_id DESC
				LIMIT ${limit}
				OFFSET ${offset}
			`);

			const [totalCountQuery] = await db.sequelize.query(`
				SELECT count(*) as c
				FROM dataset_history
				WHERE dataset_id = ${dataSetId} 
			`, { raw: true, type: db.sequelize.QueryTypes.SELECT });

			return {
				totalCount: totalCountQuery.c,
				results: results.map((row) => ({
					dataSetId: row.dataset_id,
					historyId: row.history_id,
					content: row.content,
					dateCreated: row.date_created
				}))
			};
		}
	},

	Mutation: {
		// authentication resolvers
		login: authResolvers.login,
		loginWithGoogle: authResolvers.loginWithGoogle,
		sendPasswordResetEmail: authResolvers.sendPasswordResetEmail,
		refreshToken: authResolvers.checkAndUpdateRefreshToken,
		logout: authResolvers.logout,

		// account-related resolvers
		updateAccount: accountResolvers.updateAccount,
		updateCurrentAccount: accountResolvers.updateCurrentAccount,
		updatePassword: accountResolvers.updatePassword,
		createUserAccount: accountResolvers.createUserAccount,
		deleteAccount: accountResolvers.deleteAccount,

		// data-sets
		saveNewDataSet: dataSetResolvers.saveNewDataSet,
		renameDataSet: dataSetResolvers.renameDataSet,
		saveDataSet: dataSetResolvers.saveDataSet,
		deleteDataSet: dataSetResolvers.deleteDataSet,
		updateDataSetGenerationCount: dataSetResolvers.updateDataSetGenerationCount
	}
};


module.exports = resolvers;
