const db = require('../database');
const authUtils = require('../utils/authUtils');
const authResolvers = require('./resolvers/auth');
const accountResolvers = require('./resolvers/account');
const dataSetResolvers = require('./resolvers/dataSets');

const resolvers = {
	Query: {
		accounts: async (root, args, { token, user }) => {
			authUtils.authenticate(token);
			return db.accounts.findAll({
				where: {
					createdBy: user.accountId
				},
				order: [
					['dateCreated', 'DESC']
				]
			});
		},

		account: async (root, args, { user, token }) => {
			authUtils.authenticate(token);
			return db.accounts.findByPk(user.accountId);
		},

		dataSets: async (root, args, { token, user }) => {
			authUtils.authenticate(token);

			const { accountId } = user;
			return db.dataSets.findAll({
				where: {
					accountId
				},
				order: [
					['dateCreated', 'DESC']
				]
			});
		}
	},

	Mutation: {
		// authentication resolvers
		login: authResolvers.login,
		loginWithGoogle: authResolvers.loginWithGoogle,
		refreshToken: authResolvers.refreshToken,
		logout: authResolvers.logout,

		// account-related resolvers
		updateAccount: accountResolvers.updateAccount,
		updatePassword: accountResolvers.updatePassword,
		saveNewDataSet: dataSetResolvers.saveNewDataSet,
		saveDataSet: dataSetResolvers.saveDataSet,
		deleteDataSet: dataSetResolvers.deleteDataSet
	}
};


module.exports = resolvers;
