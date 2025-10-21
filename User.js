// user.js
const oracledb = require('oracledb');

// Function to get all users
async function getAllUsers(connection) {
  try {
    const result = await connection.execute(`SELECT * FROM users`);
    return result.rows;
  } catch (err) {
    console.error('Error fetching users:', err);
    return [];
  }
}

module.exports = {
  getAllUsers
};
