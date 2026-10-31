import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

const SYSTEM_PROMPT = `Kamu adalah Kastor AI, asisten AI resmi untuk siswa dan pengurus kelas SMK (ARAS 1.0 Classroom Assistant).

IDENTITAS UTAMA:
- Nama kamu adalah "Kastor AI".
- Kamu BUKAN Gemini, BUKAN Google, BUKAN OpenAI, dan BUKAN Llama.
- Jangan pernah menyebut dirimu sebagai model bahasa besar atau AI buatan Google/OpenAI. Jika pengguna bertanya siapa kamu, katakan dengan ramah dan percaya diri: "Saya adalah *Kastor AI*, asisten pintar untuk kelas kamu."

PEDOMAN FORMAT JAWABAN (UNTUK WHATSAPP):
1. Rapi, Bersih & Ramah Layar HP:
   - Gunakan format teks WhatsApp: *teks tebal* untuk penekanan/judul, _teks miring_ untuk istilah asing, dan \`kode/istilah\` untuk teks teknis.
   - JANGAN PERNAH menggunakan Markdown heading (#, ##, ###) atau Markdown table (| col | col |) karena WhatsApp tidak merendernya dan menyebabkan tampilan di HP berantakan. Gunakan bullet list (•) atau penomoran (1., 2.).
   - Pisahkan poin atau paragraf dengan satu baris kosong agar pesan mudah dibaca di layar HP.
2. Ringkas, Solutif & Terstruktur:
   - Berikan jawaban yang langsung menjawab inti pertanyaan, langkah demi langkah, dan mudah dipahami siswa SMK.
   - Hindari basa-basi pembuka dan penutup yang berlebihan.
3. Bidang Kejuruan & Tugas Sekolah:
   - Pahami dengan baik materi kejuruan SMK (Pemrograman Web, Basis Data, Jaringan, RPL, TKJ, Otomotif, Listrik, Mesin, dsb) maupun mapel umum.
   - Jika menjawab soal pilihan ganda, sebutkan opsi jawaban yang benar (mis. "*Kunci Jawaban: C*") lalu beri penjelasan ringkas yang logis.
   - Jika menulis kode pemrograman, gunakan blok kode yang bersih dan sertakan komentar penjelasan ringkas.
4. Nada Bicara:
   - Bahasa Indonesia yang santun, akrab, edukatif, suportif, dan solutif.`;

/**
 * Ekstraksi teks dari berkas dokumen (PDF, Word docx, Excel xlsx/xls, teks biasa, atau gambar)
 */
export async function extractTextFromDocument(buffer, fileName = '', mimetype = '') {
  if (!buffer || buffer.length === 0) return null;

  const ext = path.extname(fileName || '').toLowerCase();

  // 1. Berkas Teks Biasa / Source Code (.txt, .csv, .md, .json, .py, .js, .html, .css, .sql, dll)
  if (['.txt', '.csv', '.md', '.json', '.sql', '.py', '.js', '.ts', '.html', '.css', '.cpp', '.c', '.java', '.php'].includes(ext) || mimetype.startsWith('text/')) {
    try {
      return buffer.toString('utf-8');
    } catch {}
  }

  // 2. Berkas Excel Spreadsheet (.xlsx, .xls)
  if (ext === '.xlsx' || ext === '.xls' || mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      return workbook.SheetNames.map(sheet => {
        const ws = workbook.Sheets[sheet];
        return `=== Lembar: ${sheet} ===\n` + xlsx.utils.sheet_to_csv(ws);
      }).join('\n\n');
    } catch (e) {
      console.error('Error mengekstrak teks Excel:', e.message);
    }
  }

  // 3. Berkas PDF (.pdf)
  if (ext === '.pdf' || mimetype === 'application/pdf') {
    const tmpFile = path.resolve(`./tmp_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.pdf`);
    try {
      fs.writeFileSync(tmpFile, buffer);
      const output = execSync(`pdftotext "${tmpFile}" -`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      if (output && output.trim()) {
        return output.trim();
      }
    } catch (e) {
      console.error('Error pdftotext:', e.message);
    } finally {
      if (fs.existsSync(tmpFile)) try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  // 4. Berkas Microsoft Word (.docx)
  if (ext === '.docx' || mimetype.includes('wordprocessingml')) {
    const tmpFile = path.resolve(`./tmp_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.docx`);
    try {
      fs.writeFileSync(tmpFile, buffer);
      const pythonScript = `import zipfile, xml.etree.ElementTree as ET, sys
try:
    with zipfile.ZipFile("${tmpFile}") as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        paras = []
        for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            t = ''.join([n.text for n in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if n.text])
            if t: paras.append(t)
        print('\\n'.join(paras))
except Exception as e:
    sys.exit(1)`;
      const output = execSync(`python3 -c ${JSON.stringify(pythonScript)}`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      if (output && output.trim()) {
        return output.trim();
      }
    } catch (e) {
      console.error('Error ekstraksi docx:', e.message);
    } finally {
      if (fs.existsSync(tmpFile)) try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  // 5. Berkas Gambar / Foto (.jpg, .jpeg, .png, .webp) via OCR Vision
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) || mimetype.startsWith('image/')) {
    try {
      const { performOcr } = await import('./media.js');
      const ocrResult = await performOcr(buffer);
      if (ocrResult && ocrResult.trim()) {
        return ocrResult.trim();
      }
    } catch (e) {
      console.error('Error OCR gambar dokumen:', e.message);
    }
  }

  // 6. Fallback: coba string utf-8 jika readable
  try {
    const str = buffer.toString('utf-8');
    if (str && !/[\x00-\x08\x0E-\x1F]/.test(str.slice(0, 500))) {
      return str;
    }
  } catch {}

  return null;
}

/**
 * Pemanggilan langsung ke Google Generative Language API (Gemini)
 */
async function callGeminiApi(apiKey, model, systemPrompt, finalPrompt) {
  const modelsToTry = [
    model || 'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest'
  ];

  let lastError = null;

  for (const m of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const payload = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: finalPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2500
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${res.status}`;
        lastError = `[${m}] ${errMsg}`;
        continue;
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply && reply.trim()) {
        return reply.trim();
      }
    } catch (err) {
      lastError = `[${m}] ${err.message}`;
    }
  }

  throw new Error(`Google Gemini API (${lastError || 'semua model gemini sibuk'})`);
}

/**
 * Handle AI mention atau reply di dalam grup / PM
 */
export async function askAiAssistant(userPrompt, documentData = null, quotedContext = null) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  const model = process.env.AI_MODEL || (provider === 'gemini' || provider === 'google' ? 'gemini-3.5-flash' : 'llama-3.1-8b-instant');

  // Susun prompt akhir jika ada konteks pesan yang di-reply atau lampiran dokumen
  let finalPrompt = userPrompt || '';

  if (quotedContext && typeof quotedContext === 'string' && quotedContext.trim()) {
    const quotedSnippet = quotedContext.length > 8000 
      ? quotedContext.slice(0, 8000) + '\n\n... (Sebagian teks sumber dipotong karena terlalu panjang)'
      : quotedContext;

    finalPrompt = `[SUMBER RUJUKAN / PESAN YANG DI-REPLY PENGGUNA]:\n"""\n${quotedSnippet.trim()}\n"""\n\n` +
      `[PERTANYAAN / INSTRUKSI PENGGUNA TERHADAP SUMBER DI ATAS]:\n` +
      `${userPrompt || 'Tolong pelajari dan tindak lanjuti teks sumber rujukan di atas secara tepat, ringkas, dan jelas.'}`;
  }

  if (documentData && documentData.text) {
    const fileName = documentData.fileName || 'Dokumen Tugas';
    const docSnippet = documentData.text.length > 15000 
      ? documentData.text.slice(0, 15000) + '\n\n... (Sebagian teks dokumen dipotong karena terlalu panjang)'
      : documentData.text;

    finalPrompt = `[LAMPIRAN DOKUMEN TUGAS / MATERI DARI GURU]\n` +
      `Nama Berkas: ${fileName}\n` +
      `Isi Dokumen:\n"""\n${docSnippet}\n"""\n\n` +
      `${finalPrompt || '[INSTRUKSI / PERTANYAAN SISWA]:\nTolong pelajari isi dokumen di atas, lalu bantu jelaskan materi dan berikan jawaban/penyelesaian tugas yang ada di dalamnya secara tepat dan mudah dipahami.'}`;
  }

  try {
    // 1. Google Gemini API (Utama & Rekomendasi)
    if (provider === 'gemini' || provider === 'google' || (apiKey && (apiKey.startsWith('AQ.') || apiKey.startsWith('AIzaSy')))) {
      if (!apiKey) {
        return '🤖 *Asisten AI:* Google Gemini API Key belum dikonfigurasi di file `.env`.';
      }
      return await callGeminiApi(apiKey, model, SYSTEM_PROMPT, finalPrompt);
    }

    // 2. Ollama Lokal
    if (provider === 'ollama') {
      const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: finalPrompt }
          ],
          stream: false
        })
      });

      if (!res.ok) throw new Error(`Ollama error HTTP ${res.status}`);
      const data = await res.json();
      return data.message?.content || 'Maaf, belum bisa merespons saat ini.';
    }

    // 3. Cloud OpenAI-Compatible (Groq / OpenRouter)
    const baseUrl = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';

    if (!apiKey) {
      // Fallback gratis instan tanpa butuh API key (Pollinations)
      try {
        const res = await fetch('https://text.pollinations.ai/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: finalPrompt }
            ],
            model: 'openai',
            seed: 42
          })
        });
        if (res.ok) {
          const text = await res.text();
          return text.trim() || 'Ada yang bisa saya bantu?';
        }
      } catch {}
      return '🤖 *Asisten AI:* API Key AI belum dikonfigurasi di file `.env`. Silakan isi `AI_API_KEY`.';
    }

    const freeModels = [
      model,
      'google/gemma-4-31b-it:free',
      'liquid/lfm-2.5-2.6b:free',
      'nvidia/nemotron-3.5-lightning:free'
    ];

    let lastError = null;
    for (const m of freeModels) {
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/syid/whatsapp-classroom-bot',
            'X-Title': 'ARAS Classroom Bot'
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: finalPrompt }
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply) return reply.trim();
        } else {
          lastError = `HTTP ${res.status}`;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    throw new Error(`Cloud AI (${lastError || 'semua model sibuk'})`);
  } catch (err) {
    console.error('Error memanggil AI Assistant:', err.message);
    return `🤖 Maaf, asisten AI sedang mengalami gangguan koneksi (${err.message}).`;
  }
}
