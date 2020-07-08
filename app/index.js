const express = require('express');
const fs = require('fs');
// eslint-disable-next-line no-unused-vars
const pug = require('pug');
const bsParser = require('./bs-parser');

let roster;
fs.readFile('test/sample.ros', 'utf-8', (err, data) => {
  if (err) {
    console.error(`something went wrong :( -- ${err.message})`);
    return;
  }
  roster = bsParser(data);
});

const app = express();
app.set('views', 'views');
app.set('view engine', 'pug');
app.use('/assets', express.static('assets'));
app.get('/', (req, res) => {
  res.render('index', {roster});
});
app.listen(3000, '127.0.0.1');
module.exports = app;
