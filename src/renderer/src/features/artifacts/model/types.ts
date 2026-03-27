export type ArtifactType =
  | 'html'
  | 'jsx'
  | 'css'
  | 'json'
  | 'text'
  | 'image'
  | 'code'
  | 'markdown'
  | 'csv'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'font'
  | 'websearch'

export interface Artifact {
  id: string
  name: string
  type: ArtifactType
  content?: string
  path?: string
  slides?: string[]
  data?: string[][]
  fileSize?: number
  fileTooLarge?: boolean
}

export interface ArtifactPreviewProps {
  artifact: Artifact | null
  onClose?: () => void
  allArtifacts?: Artifact[]
}

export type ViewMode = 'preview' | 'code'

export interface PreviewComponentProps {
  artifact: Artifact
}

export interface ExcelSheet {
  name: string
  data: string[][]
}

export interface PptxSlide {
  index: number
  title: string
  content: string[]
  imageUrl?: string
}

export interface DocxParagraph {
  text: string
  style?: string
  isBold?: boolean
  isItalic?: boolean
  isHeading?: boolean
  headingLevel?: number
}
