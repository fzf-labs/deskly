export type SystemCliToolCategory = 'media' | 'data' | 'search' | 'download' | 'document'

export type SystemCliPlatform = 'darwin' | 'linux' | 'win32'

export type SystemCliToolInstallState = 'unknown' | 'checking' | 'installed' | 'missing' | 'error'

export type SystemCliToolDetectionLevel = 'fast' | 'full'
export type SystemCliPackageManager = 'brew' | 'pipx' | 'npm' | 'cargo'
export type SystemCliInstalledSource = SystemCliPackageManager | 'system'

export const SYSTEM_CLI_PACKAGE_MANAGERS: SystemCliPackageManager[] = [
  'brew',
  'npm',
  'pipx',
  'cargo'
]

export const SYSTEM_CLI_INSTALLED_SOURCES: SystemCliInstalledSource[] = [
  ...SYSTEM_CLI_PACKAGE_MANAGERS,
  'system'
]

export interface LocalizedText {
  zh: string
  en: string
}

export interface SystemCliToolInstallMethod {
  label: string
  command: string
  platforms?: SystemCliPlatform[]
}

export interface SystemCliToolExamplePrompt {
  label: LocalizedText
  prompt: LocalizedText
}

export interface SystemCliToolPackageSource {
  manager: SystemCliPackageManager
  packages: string[]
}

export interface SystemCliToolDefinition {
  id: string
  command: string
  binNames: string[]
  displayName: string
  category: SystemCliToolCategory
  summary: LocalizedText
  detailIntro: LocalizedText
  useCases: LocalizedText[]
  guideSteps: LocalizedText[]
  examplePrompts: SystemCliToolExamplePrompt[]
  packageSources?: SystemCliToolPackageSource[]
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
  installedVia?: SystemCliInstalledSource
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
    detailIntro: {
      zh: 'FFmpeg 是功能非常完整的音视频命令行工具，适合做格式转换、片段裁剪、音轨提取、压缩与批量处理。让 Agent 先理解需求，再由它生成具体参数，通常比手写命令更高效。',
      en: 'FFmpeg is a powerful command-line toolkit for video and audio conversion, trimming, extraction, compression, and batch processing. It works especially well when an agent turns your intent into exact flags.'
    },
    useCases: [
      { zh: '将 mov 或 mkv 转换为 mp4', en: 'Convert mov or mkv files into mp4' },
      { zh: '从视频中提取音频或截取片段', en: 'Extract audio or clip segments from video' }
    ],
    guideSteps: [
      { zh: '先安装 FFmpeg，并在终端运行 ffmpeg -version 验证。', en: 'Install FFmpeg first, then verify it with ffmpeg -version.' },
      { zh: '准备好输入文件路径，再明确你的目标格式、时长或画质要求。', en: 'Prepare the input file path and be clear about the target format, duration, or quality.' },
      { zh: '让 Agent 根据需求生成命令后，再在终端执行并检查输出文件。', en: 'Let the agent generate the command for your goal, then run it and inspect the output file.' }
    ],
    examplePrompts: [
      {
        label: { zh: '转换格式', en: 'Convert format' },
        prompt: {
          zh: '用 FFmpeg 把 input.mov 转成 MP4，尽量保持原始画质。',
          en: 'Use FFmpeg to convert input.mov into MP4 while keeping the original quality.'
        }
      },
      {
        label: { zh: '提取音频', en: 'Extract audio' },
        prompt: {
          zh: '用 FFmpeg 从视频里提取音频并导出为 MP3。',
          en: 'Use FFmpeg to extract audio from a video and export it as MP3.'
        }
      }
    ],
    packageSources: [
      { manager: 'brew', packages: ['ffmpeg'] }
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
    detailIntro: {
      zh: 'jq 很适合处理接口响应、配置文件和日志里的 JSON 数据。对于需要批量提取字段、筛选数组或格式化输出的场景，它往往是最省事的系统工具之一。',
      en: 'jq is ideal for API responses, config files, and JSON logs. It is one of the most efficient CLI tools for extracting fields, filtering arrays, and reshaping structured data.'
    },
    useCases: [
      { zh: '从接口响应中提取字段', en: 'Extract fields from API responses' },
      { zh: '格式化 JSON 文件便于阅读', en: 'Pretty-print JSON files for inspection' }
    ],
    guideSteps: [
      { zh: '安装 jq 后运行 jq --version 进行验证。', en: 'Install jq and verify it with jq --version.' },
      { zh: '确认要处理的 JSON 来源，例如文件、剪贴板内容或命令输出。', en: 'Identify the JSON source you want to process, such as a file, clipboard content, or command output.' },
      { zh: '把目标描述清楚，让 Agent 生成 jq 过滤表达式。', en: 'Describe the desired output clearly so the agent can generate the jq filter.' }
    ],
    examplePrompts: [
      {
        label: { zh: '提取依赖', en: 'Extract dependencies' },
        prompt: {
          zh: '用 jq 从 package.json 中提取所有 dependencies 的名称。',
          en: 'Use jq to extract all dependency names from package.json.'
        }
      },
      {
        label: { zh: '筛选数组', en: 'Filter array' },
        prompt: {
          zh: '用 jq 过滤 JSON 数组里 status 为 active 的项目。',
          en: 'Use jq to filter JSON array items where status is active.'
        }
      }
    ],
    packageSources: [
      { manager: 'brew', packages: ['jq'] }
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
    detailIntro: {
      zh: 'ripgrep（rg）适合在大仓库里快速查找符号、日志关键词和配置项引用。它默认尊重 .gitignore，通常比 grep 更适合开发场景。',
      en: 'ripgrep (rg) is a fast search tool for large repositories. It respects .gitignore by default and is usually a better fit than grep for day-to-day development work.'
    },
    useCases: [
      { zh: '查找函数或配置项的引用位置', en: 'Find references to functions or configuration values' },
      { zh: '扫描 TODO、FIXME 或日志关键字', en: 'Scan for TODO, FIXME, or log keywords' }
    ],
    guideSteps: [
      { zh: '安装 ripgrep，并运行 rg --version 确认可用。', en: 'Install ripgrep and confirm it with rg --version.' },
      { zh: '确定搜索范围，例如整个仓库、某个目录或某类文件。', en: 'Choose the search scope, such as the whole repo, one directory, or a file type.' },
      { zh: '把模式或意图告诉 Agent，让它生成更精确的 rg 参数。', en: 'Tell the agent the pattern or intent so it can generate a more precise rg command.' }
    ],
    examplePrompts: [
      {
        label: { zh: '搜索 TODO', en: 'Find TODOs' },
        prompt: {
          zh: '用 ripgrep 在当前项目里搜索所有 TODO 注释。',
          en: 'Use ripgrep to find all TODO comments in the current project.'
        }
      },
      {
        label: { zh: '查找调用', en: 'Find usage' },
        prompt: {
          zh: '用 rg 查找某个函数在哪些文件中被调用。',
          en: 'Use rg to find which files call a specific function.'
        }
      }
    ],
    packageSources: [
      { manager: 'brew', packages: ['ripgrep'] },
      { manager: 'cargo', packages: ['ripgrep'] }
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
    detailIntro: {
      zh: 'yt-dlp 适合抓取公开可访问的音视频资源，并支持格式选择、只取音频、字幕和播放列表处理。对于需要和 FFmpeg 组合的工作流也很常见。',
      en: 'yt-dlp is useful for downloading publicly accessible media, selecting formats, extracting audio, downloading subtitles, and handling playlists. It is also commonly paired with FFmpeg in automation workflows.'
    },
    useCases: [
      { zh: '下载在线视频并保留高质量格式', en: 'Download online videos in high quality formats' },
      { zh: '只提取音频或字幕文件', en: 'Extract only audio tracks or subtitle files' }
    ],
    guideSteps: [
      { zh: '安装 yt-dlp，并通过 yt-dlp --version 验证。', en: 'Install yt-dlp and verify it with yt-dlp --version.' },
      { zh: '确认目标站点和资源是你可以合法访问与下载的。', en: 'Make sure the target site and media are legally accessible for you to download.' },
      { zh: '把需要的视频地址、格式偏好或输出要求交给 Agent。', en: 'Give the agent the media URL plus any format or output preferences.' }
    ],
    examplePrompts: [
      {
        label: { zh: '下载最高画质', en: 'Download best quality' },
        prompt: {
          zh: '用 yt-dlp 下载这个视频的最高画质版本。',
          en: 'Use yt-dlp to download the highest-quality version of this video.'
        }
      },
      {
        label: { zh: '只提取音频', en: 'Extract audio only' },
        prompt: {
          zh: '用 yt-dlp 只下载音频并转成 MP3。',
          en: 'Use yt-dlp to download audio only and convert it to MP3.'
        }
      }
    ],
    packageSources: [
      { manager: 'brew', packages: ['yt-dlp'] },
      { manager: 'pipx', packages: ['yt-dlp'] }
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
    detailIntro: {
      zh: 'Pandoc 很适合在 Markdown、HTML、Word、PDF 等格式之间做转换，也常用于文档流水线和自动化导出。对写作、整理知识库和批量格式处理都很有帮助。',
      en: 'Pandoc is excellent for converting between Markdown, HTML, Word, PDF, and many other formats. It is especially helpful in documentation pipelines, knowledge-base cleanup, and batch export workflows.'
    },
    useCases: [
      { zh: '将 Markdown 转为 PDF 或 Word', en: 'Convert Markdown into PDF or Word documents' },
      { zh: '把 HTML 内容转为更易编辑的文本格式', en: 'Turn HTML content into editable text formats' }
    ],
    guideSteps: [
      { zh: '安装 Pandoc，并运行 pandoc --version 进行确认。', en: 'Install Pandoc and confirm it with pandoc --version.' },
      { zh: '准备输入文件和目标格式，例如 Markdown 转 PDF 或 HTML 转 Markdown。', en: 'Prepare the input file and target format, such as Markdown to PDF or HTML to Markdown.' },
      { zh: '让 Agent 根据输出需求补齐参数，再执行转换命令。', en: 'Let the agent add the right flags for the output you want, then run the conversion command.' }
    ],
    examplePrompts: [
      {
        label: { zh: 'Markdown 转 PDF', en: 'Markdown to PDF' },
        prompt: {
          zh: '用 Pandoc 把 README.md 转成 PDF。',
          en: 'Use Pandoc to convert README.md into PDF.'
        }
      },
      {
        label: { zh: 'HTML 转 Markdown', en: 'HTML to Markdown' },
        prompt: {
          zh: '用 Pandoc 把网页 HTML 转成 Markdown。',
          en: 'Use Pandoc to convert an HTML page into Markdown.'
        }
      }
    ],
    packageSources: [
      { manager: 'brew', packages: ['pandoc'] }
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

export const DEFAULT_RECOMMENDED_SYSTEM_CLI_TOOL_IDS = SYSTEM_CLI_TOOLS.map((tool) => tool.id)

export const resolveSystemCliInstallMethods = (
  methods: SystemCliToolInstallMethod[],
  platform: SystemCliPlatform
): SystemCliToolInstallMethod[] => {
  const matched = methods.filter((method) => !method.platforms || method.platforms.includes(platform))
  return matched.length > 0 ? matched : methods
}
