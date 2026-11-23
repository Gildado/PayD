import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TemplateData, TemplateRenderer } from '../templateRenderer.js';

const templatesDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../templates/notifications'
);

const templateFiles = fs
  .readdirSync(templatesDirectory)
  .flatMap((fileName) => {
    const match = /^(.*)\.(\w+)\.(html|txt)$/.exec(fileName);
    return match
      ? [{ fileName, templateName: match[1], locale: match[2], format: match[3] }]
      : [];
  })
  .sort((left, right) => left.fileName.localeCompare(right.fileName));

const templateData: TemplateData = {
  employeeFirstName: `<First & "O' />`,
  employeeLastName: `Last <name>`,
  amount: '123.45',
  currency: '<USD&>',
  transactionHash: `hash<&"'/`,
  transactionUrl: `https://example.test/tx?x=<script>&q="'/`,
  paymentDate: '2025-03-04T12:30:00.000Z',
  organizationName: `<Pay&D "'>`,
  locale: 'en-US',
};

describe('notification templates', () => {
  const renderer = new TemplateRenderer(templatesDirectory);

  it('discovers notification templates to render', () => {
    expect(templateFiles.length).toBeGreaterThan(0);
  });

  it.each(templateFiles)('$fileName renders all declared variables', ({ templateName, locale, format }) => {
    const data = { ...templateData, locale };
    const source = fs.readFileSync(path.join(templatesDirectory, `${templateName}.${locale}.${format}`), 'utf-8');
    const variables = [...source.matchAll(/\{\{(\w+)\}\}/g)].map(([, variable]) => variable);

    for (const variable of variables) {
      expect(Object.prototype.hasOwnProperty.call(data, variable)).toBe(true);
    }

    const rendered =
      format === 'html'
        ? renderer.renderHtml(templateName, data)
        : renderer.renderText(templateName, data);

    expect(rendered).not.toMatch(/\{\{[^{}]+\}\}/);
    expect(rendered.trim()).not.toBe('');
  });

  it.each(templateFiles.filter(({ format }) => format === 'html'))(
    '$fileName escapes fixture values in HTML output',
    ({ templateName, locale }) => {
      const rendered = renderer.renderHtml(templateName, {
        ...templateData,
        locale,
      });

      expect(rendered).toContain('&lt;First &amp; &quot;O&#39; &#x2F;&gt;');
      expect(rendered).toContain('&lt;USD&amp;&gt;');
      expect(rendered).toContain('hash&lt;&amp;&quot;&#39;&#x2F;');
      expect(rendered).toContain('&lt;script&gt;');
      expect(rendered).toContain('&lt;Pay&amp;D &quot;&#39;&gt;');
      expect(rendered).not.toContain('<script>');
      expect(rendered).not.toContain('<First');
      expect(rendered).not.toContain('<USD');
      expect(rendered).not.toContain('<Pay');
    }
  );
});
