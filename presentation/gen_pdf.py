from markdown_pdf import Section, MarkdownPdf

pdf = MarkdownPdf(toc_level=2)
pdf.add_section(Section("presentation.md", toc=False))
pdf.meta["title"] = "SerenityAI Presentation"
pdf.meta["author"] = "SerenityAI"
pdf.save("presentation.pdf")
