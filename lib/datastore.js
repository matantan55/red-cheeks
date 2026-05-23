const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'users.json');

function ensureFile() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ users: [] }, null, 2));
  }
}

function readData() {
  ensureFile();
  const raw = fs.readFileSync(dataFile, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function getAllUsers() {
  return readData().users;
}

function findUserByEmail(email) {
  const users = getAllUsers();
  return users.find(u => u.email === email);
}

function addUser(user) {
  const data = readData();
  data.users.push(user);
  writeData(data);
}

module.exports = {
  getAllUsers,
  findUserByEmail,
  addUser,
};
