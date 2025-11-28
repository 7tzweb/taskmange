import { Editor } from '@tinymce/tinymce-react';
import 'tinymce/tinymce';
import 'tinymce/icons/default';
import 'tinymce/themes/silver';
import 'tinymce/models/dom';
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/code';
import 'tinymce/plugins/directionality';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/table';
import 'tinymce/plugins/wordcount';
import 'tinymce/plugins/image';
import 'tinymce/skins/ui/oxide/skin.min.css';
import 'tinymce/skins/ui/oxide/content.min.css';
import 'tinymce/skins/content/default/content.min.css';

export default function RichTextEditor({ value, onChange, rtl = true, height = 520 }) {
  return (
    <Editor
      value={value}
      onEditorChange={(val) => onChange?.(val)}
      init={{
        license_key: 'gpl',
        promotion: false,
        menubar: false,
        branding: false,
        rtl_ui: true,
        directionality: rtl ? 'rtl' : 'ltr',
        height,
        toolbar_mode: 'wrap',
        toolbar_sticky: true,
        skin: false,
        content_css: false,
        entity_encoding: 'raw',
        convert_urls: false,
        forced_root_block: 'p',
        plugins: ['advlist', 'autolink', 'lists', 'link', 'table', 'code', 'directionality', 'wordcount', 'image'],
        toolbar:
          'undo redo | blocks | bold italic underline strikethrough | forecolor backcolor | ' +
          'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table | ltr rtl | link image | code',
        block_formats: 'כותרת 1=h1; כותרת 2=h2; כותרת 3=h3; פסקה=p',
        paste_data_images: true,
        automatic_uploads: false,
        images_file_types: 'jpeg,jpg,png,gif,webp',
        content_style: `
          body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Arial, Helvetica, sans-serif;
                 font-size: 17px; line-height: 1.8;
                 direction: ${rtl ? 'rtl' : 'ltr'}; text-align: ${rtl ? 'right' : 'left'}; }
          table { border-collapse: collapse; width: 100%; }
          table, th, td { border: 1px solid #e6e8ee; }
          th, td { padding: 8px; }
        `,
      }}
    />
  );
}
