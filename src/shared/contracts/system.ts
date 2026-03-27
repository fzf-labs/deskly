export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

export interface FileStat {
  size: number
  isFile: boolean
  isDirectory: boolean
}

export interface DialogFilter {
  name: string
  extensions: string[]
}

export interface SaveDialogOptions {
  defaultPath?: string
  filters?: DialogFilter[]
}

export interface OpenDialogOptions {
  multiple?: boolean
  directory?: boolean
  properties?: string[]
  title?: string
  filters?: DialogFilter[]
}
