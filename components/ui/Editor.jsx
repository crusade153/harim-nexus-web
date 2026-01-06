'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Unlink, Code } from 'lucide-react'

const MenuBar = ({ editor }) => {
  if (!editor) return null

  const btnClass = (isActive) => 
    `p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
      isActive ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-500 dark:text-slate-400'
    }`

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    // ✅ [수정] 링크 설정 시 target='_blank' 강제 적용
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run()
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))}><Bold size={16}/></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))}><Italic size={16}/></button>
      <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1 self-center" />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))}><List size={16}/></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))}><ListOrdered size={16}/></button>
      <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1 self-center" />
      <button onClick={setLink} className={btnClass(editor.isActive('link'))}><LinkIcon size={16}/></button>
      {editor.isActive('link') && (
        <button onClick={() => editor.chain().focus().unsetLink().run()} className={btnClass(false)}><Unlink size={16}/></button>
      )}
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive('codeBlock'))}><Code size={16}/></button>
    </div>
  )
}

export default function Editor({ content, onChange, editable = true }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      // ✅ [수정] Link 설정: 클릭 시 새 탭 열기 (HTMLAttributes 적용)
      Link.configure({ 
        openOnClick: false, 
        autolink: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        }
      })
    ],
    content: content,
    editable: editable,
    immediatelyRender: false, 
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[150px] p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200'
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    }
  })

  if (!editor) return null

  return (
    <div className={`border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900Ql transition-colors focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 ${!editable ? 'border-none bg-transparent' : ''}`}>
      {editable && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}