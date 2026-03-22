export type SystemCliToolCategory = 'media' | 'data' | 'search' | 'download' | 'document'

export type SystemCliPlatform = 'darwin' | 'linux' | 'win32'

export type SystemCliToolInstallState = 'unknown' | 'checking' | 'installed' | 'missing' | 'error'

export type SystemCliToolDetectionLevel = 'fast' | 'full'

export interface LocalizedText {
  zh: string
  en: string
}

export interface SystemCliToolInstallMethod {
  label: string
  command: string
  platforms?: SystemCliPlatform[]
}

export interface SystemCliToolDefinition {
  id: string
  command: string
  binNames: string[]
  displayName: string
  category: SystemCliToolCategory
  summary: LocalizedText
  useCases: LocalizedText[]
  installMethods: SystemCliToolInstallMethod[]
  docsUrl: string
  homepageUrl?: string
}

export interface SystemCliToolInfo extends SystemCliToolDefinition {
  platform: SystemCliPlatform
  installed?: boolean
  installState: SystemCliToolInstallState
  version?: string
  installPath?: string
  checkedLevel?: SystemCliToolDetectionLevel
  lastCheckedAt?: string
  latencyMs?: number
  errorMessage?: string
}

export const SYSTEM_CLI_TOOLS: SystemCliToolDefinition[] = [
  {
    id: 'ffmpeg',
    command: 'ffmpeg',
    binNames: ['ffmpeg'],
    displayName: 'FFmpeg',
    category: 'media',
    summary: {
      zh: '音视频处理工具，适合转码、裁剪、拼接与提取音频。',
      en: 'Audio and video toolkit for transcoding, trimming, merging, and extraction.'
    },
    useCases: [
      { zh: '将 mov 或 mkv 转换为 mp4', en: 'Convert mov or mkv files into mp4' },
      { zh: '从视频中提取音频或截取片段', en: 'Extract audio or clip segments from video' }
    ],
    installMethods: [
      { label: 'Homebrew', command: 'brew install ffmpeg', platforms: ['darwin', 'linux'] },
      { label: 'APT', command: 'sudo apt install ffmpeg', platforms: ['linux'] },
      { label: 'winget', command: 'winget install Gyan.FFmpeg', platforms: ['win32'] }
    ],
    docsUrl: 'https://ffmpeg.org/documentation.html',
    homepageUrl: 'https://ffmpeg.org'
  },
  {
    id: 'jq',
    command: 'jq',
    binNames: ['jq'],
    displayName: 'jq',
    category: 'data',
    summary: {
      zh: '轻量级 JSON 处理器，适合查询、过滤和转换结构化数据。',
      en: 'Lightweight JSON processor for querying, filtering, and transforming structured data.'
    },
    useCases: [
      { zh: '从接口响应中提取字段', en: 'Extract fields from API responses' },
      { zh: '格式化 JSON 文件便于阅读', en: 'Pretty-print JSON files for inspection' }
    ],
    installMethods: [
      { label: 'Homebrew', command: 'brew install jq', platforms: ['darwin', 'linux'] },
      { label: 'APT', command: 'sudo apt install jq', platforms: ['linux'] },
      { label: 'winget', command: 'winget install jqlang.jq', platforms: ['win32'] }
    ],
    docsUrl: 'https://jqlang.github.io/jq/manual/',
    homepageUrl: 'https://jqlang.github.io/jq/'
  },
  {
    id: 'ripgrep',
    command: 'rg',
    binNames: ['rg'],
    displayName: 'ripgrep',
    category: 'search',
    summary: {
      zh: '极速文本搜索工具，适合在代码库中搜索模式和引用。',
      en: 'Fast text search tool for locating patterns and references across codebases.'
    },
    useCases: [
      { zh: '查找函数或配置项的引用位置', en: 'Find references to functions or configuration values' },
      { zh: '扫描 TODO、FIXME 或日志关键字', en: 'Scan for TODO, FIXME, or log keywords' }
    ],
    installMethods: [
      { label: 'Homebrew', command: 'brew install ripgrep', platforms: ['darwin', 'linux'] },
      { label: 'APT', command: 'sudo apt install ripgrep', platforms: ['linux'] },
      { label: 'winget', command: 'winget install BurntSushi.ripgrep.MSVC', platforms: ['win32'] }
    ],
    docsUrl: 'https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md',
    homepageUrl: 'https://github.com/BurntSushi/ripgrep'
  },
  {
    id: 'yt-dlp',
    command: 'yt-dlp',
    binNames: ['yt-dlp'],
    displayName: 'yt-dlp',
    category: 'download',
    summary: {
      zh: '视频与音频下载工具，适合抓取公开媒体资源。',
      en: 'Video and audio downloader for fetching public media resources.'
    },
    useCases: [
      { zh: '下载在线视频并保留高质量格式', en: 'Download online videos in high quality formats' },
      { zh: '只提取音频或字幕文件', en: 'Extract only audio tracks or subtitle files' }
    ],
    installMethods: [
      { label: 'Homebrew', command: 'brew install yt-dlp', platforms: ['darwin', 'linux'] },
      { label: 'pipx', command: 'pipx install yt-dlp', platforms: ['darwin', 'linux', 'win32'] },
      { label: 'winget', command: 'winget install yt-dlp.yt-dlp', platforms: ['win32'] }
    ],
    docsUrl: 'https://github.com/yt-dlp/yt-dlp#readme',
    homepageUrl: 'https://github.com/yt-dlp/yt-dlp'
  },
  {
    id: 'pandoc',
    command: 'pandoc',
    binNames: ['pandoc'],
    displayName: 'Pandoc',
    category: 'document',
    summary: {
      zh: '通用文档格式转换器，适合 Markdown、HTML、DOCX、PDF 互转。',
      en: 'Universal document converter for Markdown, HTML, DOCX, PDF, and more.'
    },
    useCases: [
      { zh: '将 Markdown 转为 PDF 或 Word', en: 'Convert Markdown into PDF or Word documents' },
      { zh: '把 HTML 内容转为更易编辑的文本格式', en: 'Turn HTML content into editable text formats' }
    ],
    installMethods: [
      { label: 'Homebrew', command: 'brew install pandoc', platforms: ['darwin', 'linux'] },
      { label: 'APT', command: 'sudo apt install pandoc', platforms: ['linux'] },
      { label: 'winget', command: 'winget install JohnMacFarlane.Pandoc', platforms: ['win32'] }
    ],
    docsUrl: 'https://pandoc.org/MANUAL.html',
    homepageUrl: 'https://pandoc.org'
  }
]

export const resolveSystemCliInstallMethods = (
  methods: SystemCliToolInstallMethod[],
  platform: SystemCliPlatform
): SystemCliToolInstallMethod[] => {
  const matched = methods.filter((method) => !method.platforms || method.platforms.includes(platform))
  return matched.length > 0 ? matched : methods
}
