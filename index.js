const {app, BrowserWindow} = require('electron');
const {express} = require('./app');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
  });
  mainWindow.loadURL('http://localhost:3000');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length == 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform != 'darwin') app.quit();
});
