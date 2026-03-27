export const systemChannels = {
  fs: {
    readFile: 'fs:readFile',
    readTextFile: 'fs:readTextFile',
    writeFile: 'fs:writeFile',
    writeTextFile: 'fs:writeTextFile',
    appendTextFile: 'fs:appendTextFile',
    stat: 'fs:stat',
    readDir: 'fs:readDir',
    exists: 'fs:exists',
    remove: 'fs:remove',
    mkdir: 'fs:mkdir'
  },
  dialog: {
    save: 'dialog:save',
    open: 'dialog:open'
  },
  shell: {
    openUrl: 'shell:openUrl',
    openPath: 'shell:openPath',
    showItemInFolder: 'shell:showItemInFolder'
  },
  path: {
    appConfigDir: 'path:appConfigDir',
    tempDir: 'path:tempDir',
    resourcesDir: 'path:resourcesDir',
    appPath: 'path:appPath',
    desklyDataDir: 'path:desklyDataDir',
    homeDir: 'path:homeDir'
  }
} as const
