export function generateJSONData(seo, blocks) {
  const exportedBlocks = blocks.map((b) => {
    const items = b.lines
      .map((l) => ({ type: l.type, content: l.content.trim() }))
      .filter((l) => l.content || l.type === "p");

    return {
      name: b.name.trim() || "Blok",
      items: items,
    };
  });

  return {
    seo: {
      h1: seo.h1.trim(),
      metaTitle: seo.metaTitle.trim(),
      metaDescription: seo.metaDescription.trim(),
      url: seo.url.trim(),
    },
    blocks: exportedBlocks,
  };
}

export function downloadJSON(seo, blocks, showToast) {
  const saveAs = window.saveAs;
  const data = generateJSONData(seo, blocks);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  const filename =
    (seo.h1 || "icerik_koprusu")
      .replace(/[^\w\sа-яА-ЯğüşöçıİĞÜŞÖÇ-]/gi, "")
      .trim()
      .replace(/\s+/g, "_") || "icerik";
  saveAs(blob, filename + ".json");
  if (showToast) showToast("✓ JSON dosyası indirildi");
}

export async function downloadDOCX(seo, blocks, showToast) {
  const docx = window.docx;
  const saveAs = window.saveAs;

  try {
    const data = generateJSONData(seo, blocks);
    const children = [];

    if (data.seo.h1) {
      children.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: data.seo.h1,
              bold: true,
              size: 48,
              font: "Calibri",
            }),
          ],
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        })
      );
    }

    const metaFields = [
      { label: "Meta Title", value: data.seo.metaTitle },
      { label: "Meta Description", value: data.seo.metaDescription },
      { label: "URL", value: data.seo.url },
    ];

    let hasMeta = false;
    for (const field of metaFields) {
      if (field.value) {
        hasMeta = true;
        children.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: field.label + ": ",
                bold: true,
                size: 20,
                font: "Calibri",
                color: "64748B",
              }),
              new docx.TextRun({
                text: field.value,
                size: 20,
                font: "Calibri",
              }),
            ],
            spacing: { after: 60 },
          })
        );
      }
    }

    if (hasMeta || data.seo.h1) {
      children.push(
        new docx.Paragraph({
          children: [],
          spacing: { before: 200, after: 200 },
          border: {
            bottom: {
              color: "CBD5E1",
              size: 6,
              style: docx.BorderStyle.SINGLE,
              space: 1,
            },
          },
        })
      );
    }

    data.blocks.forEach((block, blockIndex) => {
      const blockTitle = block.name || "Blok " + (blockIndex + 1);
      children.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: "— " + blockTitle + " —",
              color: "94A3B8",
              italics: true,
              size: 18,
              font: "Calibri",
            }),
          ],
          alignment: docx.AlignmentType.CENTER,
          spacing: { before: 360, after: 360 },
          border: {
            top: {
              color: "E2E8F0",
              size: 4,
              style: docx.BorderStyle.DASHED,
              space: 6,
            },
            bottom: {
              color: "E2E8F0",
              size: 4,
              style: docx.BorderStyle.DASHED,
              space: 6,
            },
          },
        })
      );

      block.items.forEach((item) => {
        if (!item.content.trim() && item.type !== "p") return;

        switch (item.type) {
          case "h2":
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: item.content,
                    bold: true,
                    size: 32,
                    font: "Calibri",
                  }),
                ],
                heading: docx.HeadingLevel.HEADING_2,
                spacing: { before: 120, after: 80 },
              })
            );
            break;

          case "h3":
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: item.content,
                    bold: true,
                    size: 26,
                    font: "Calibri",
                  }),
                ],
                heading: docx.HeadingLevel.HEADING_3,
                spacing: { before: 100, after: 60 },
              })
            );
            break;
          case "h1":
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: item.content,
                    bold: true,
                    size: 40,
                    font: "Calibri",
                  }),
                ],
                heading: docx.HeadingLevel.HEADING_1,
                spacing: { before: 160, after: 120 },
              })
            );
            break;
          case "h4":
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: item.content,
                    bold: true,
                    size: 22,
                    font: "Calibri",
                  }),
                ],
                heading: docx.HeadingLevel.HEADING_4,
                spacing: { before: 100, after: 60 },
              })
            );
            break;

          case "p":
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: item.content,
                    size: 22,
                    font: "Calibri",
                  }),
                ],
                spacing: { after: 320 },
              })
            );
            break;

          case "image_link":
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.ExternalHyperlink({
                    children: [
                      new docx.TextRun({
                        text: item.content,
                        style: "Hyperlink",
                        size: 20,
                        font: "Calibri",
                      }),
                    ],
                    link: item.content,
                  }),
                ],
                spacing: { after: 80 },
              })
            );
            break;

          case "devnote":
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: "📝 " + item.content,
                    italics: true,
                    highlight: "yellow",
                    size: 20,
                    font: "Calibri",
                  }),
                ],
                spacing: { after: 100 },
              })
            );
            break;
        }
      });
    });

    const doc = new docx.Document({
      creator: "İçerik Köprüsü",
      title: data.seo.h1 || "İçerik",
      description: data.seo.metaDescription || "",
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: children,
        },
      ],
    });

    const blob = await docx.Packer.toBlob(doc);
    const filename =
      (seo.h1 || "icerik_koprusu")
        .replace(/[^\w\sа-яА-ЯğüşöçıİĞÜŞÖÇ-]/gi, "")
        .trim()
        .replace(/\s+/g, "_") || "icerik";
    saveAs(blob, filename + ".docx");
    if (showToast) showToast("✓ DOCX dosyası indirildi");
  } catch (err) {
    console.error(err);
    if (showToast) showToast("⚠ DOCX oluşturulurken hata oluştu");
  }
}
