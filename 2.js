// == Telegram Config ==
const telegramToken = '8014175766:AAHsdA-hwYSdQNQKX6g2Wj59PE56LXKMMS8'; // SIZNING TOKENINGIZ
const chatId = '-4989809671'; // SIZNING CHAT ID
let lastProcessedUpdateId = 0;

// == "Bosib turish" sozlamalari ==
let holdTimer = null;
let elementUnderCursor = null;
const HOLD_DURATION = 1200; // 1.2 soniya

// == Sahifadagi klaviatura hodisalarini o'chirish (jQuery talab qiladi) ==
try {
    if ($) {
        $(document).off('keydown keypress keyup');
        $(window).off('keydown keypress keyup');
    }
} catch (e) {
    console.warn("jQuery topilmadi, klaviatura bloklanmadi.");
}

// == Boshlang'ich skriptlarni yuklash ==
function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// == Mini-oyna ==
function createMiniWindow() {
    const miniWindowHTML = `
    <div id="mini-window" style="display: none;">
        <div id="mini-window-content">--</div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', miniWindowHTML);

    const style = document.createElement('style');
    style.innerHTML = `
    #mini-window {
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 200px;
        height: 200px;
        background: rgba(255, 255, 255, 0);
        border: none;
        border-radius: 5px;
        overflow-y: auto;
        z-index: 2147483647;
        font-family: Arial, sans-serif;
    }
    #mini-window::-webkit-scrollbar { width: 6px; }
    #mini-window::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.3); border-radius: 10px; }
    #mini-window::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.5); }
    #mini-window::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0); border-radius: 5px; }
    #mini-window-content { padding: 5px; font-size: 14px; line-height: 1.5; color: rgba(204, 204, 204, 0.75); }`;
    document.head.appendChild(style);
}

function appendMessageToMiniWindow(message) {
    const content = document.getElementById('mini-window-content');
    if (!content) return;
    if (content.textContent.trim() === "--" && content.firstChild?.nodeType === Node.TEXT_NODE) {
        content.innerHTML = '';
    }
    const msgEl = document.createElement('p');
    msgEl.textContent = message;
    content.appendChild(msgEl);
    content.scrollTop = content.scrollHeight;
}

function toggleMiniWindow() {
    const win = document.getElementById('mini-window');
    if (!win) return;
    win.style.display = win.style.display === 'none' ? 'block' : 'none';
}

// == Telegram bilan ishlash funksiyalari ==
async function sendMessageToTelegram(text) {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Xato (yuborish): ${errorData.description}`);
        }
    } catch (error) {
        console.error(`Tarmoq xatosi: ${error.message}`);
    }
}

async function screenshotAndSend() {
    try {
        await loadHtml2Canvas();
        console.log("Skrinshot olinmoqda...");
const canvas = await html2canvas(document.body, { scale: 1.5, useCORS: true });
        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('document', blob, 'screenshot.png');
            formData.append('caption', `Sahifa manzili: ${window.location.href}`);

            console.log("Skrinshot yuborilmoqda...");
            const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                console.log('Skrinshot muvaffaqiyatli yuborildi.');
            } else {
                const errorText = await res.text();
                console.error(`Xato (skrinshot): ${errorText}`);
            }
        }, 'image/png');
    } catch (error) {
        console.error(`Skrinshotda xato: ${error.message}`);
    }
}

// == Sahifani HTML fayl qilib yuborish (YANGI FUNKSIYA) ==
async function sendPageAsHtmlFile() {
    try {
        console.log("HTML fayl tayyorlanmoqda...");
        const htmlContent = document.documentElement.outerHTML;
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

        // Fayl nomini sahifa sarlavhasidan olish va tozalash
        const fileName = (document.title || 'page').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';

        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('document', htmlBlob, fileName);
        formData.append('caption', `Sahifaning HTML fayli:\n${window.location.href}`);

        console.log("HTML fayl yuborilmoqda...");
        const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            console.log('HTML fayl muvaffaqiyatli yuborildi.');
        } else {
            const errorText = await res.text();
            console.error(`Xato (HTML fayl): ${errorText}`);
        }
    } catch (error) {
        console.error(`HTML faylni yuborishda xato: ${error.message}`);
    }
}

async function getNewAnswersFromTelegram() {
    const url = `https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${lastProcessedUpdateId + 1}&timeout=30`;
    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        if (data.ok && data.result) {
            data.result.forEach(update => {
                const message = update.message;
                const updateId = update.update_id;
                if (message && message.text && updateId > lastProcessedUpdateId) {
                    lastProcessedUpdateId = updateId;
                    appendMessageToMiniWindow(message.text);
                } else if (updateId > lastProcessedUpdateId) {
                    lastProcessedUpdateId = updateId;
                }
            });
        }
    } catch (error) { /* Konsolga chiqarilmaydi */ }
}

// == Elementni topish va yuborish ==
function findMeaningfulBlock(element) {
    if (!element) return null;
    let candidate = element.closest('p, div, li, h1, h2, h3, span, td, .test-question, .answers-test');
    if (candidate && candidate.textContent.trim().length > 10) {
        return candidate;
    }
    return element.textContent.trim().length > 5 ? element : null;
}

// == Hodisalarni (events) qayta ishlash ==
document.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (key === 'x') {
        screenshotAndSend();
    }
    if (key === 'm') {
        toggleMiniWindow();
    }
    // 'h' tugmasi sahifani .html fayl qilib yuborish uchun (YANGI)
    if (key === 'h') {
        sendPageAsHtmlFile();
    }
});

document.addEventListener('mousedown', (e) => {
    if (e.button === 2) { // O'ng tugma
        elementUnderCursor = e.target;
        holdTimer = setTimeout(async () => {
            if (elementUnderCursor) {
                const block = findMeaningfulBlock(elementUnderCursor);
                if (block) {
                    const text = block.textContent?.trim();
                    const images = Array.from(block.querySelectorAll('img')).map(img => img.src).join('\n');
                    if (text || images) {
                        let messageToSend = `<b>Tanlangan blok (bosib turish):</b>\n<pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
                        if (images) {
                            messageToSend += `\n\n<b>Blokdagi rasmlar:</b>\n${images}`;
                        }
                        await sendMessageToTelegram(messageToSend);
                        console.log("Tanlangan blok yuborildi.");
                    }
                }
            }
            holdTimer = null;
        }, HOLD_DURATION);
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 2 && holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
});

document.addEventListener('contextmenu', (e) => {
    if (!holdTimer) {
        e.preventDefault();
        toggleMiniWindow();
    }
});

// == Asosiy savol-javob parseri ==
// == Asosiy savol-javob parseri (Tuzatilgan versiya) ==
async function processAndSendQuestions() {
    // Sahifadan .table-test klassiga ega barcha elementlarni topish
    const tests = document.querySelectorAll('.table-test');
    if (tests.length === 0) {
        console.warn("Savollar topilmadi (.table-test selektori bo'yicha).");
        return;
    }
    console.log(`${tests.length} ta savol topildi. Yuborilmoqda...`);

    // Elementlarni ID raqami bo'yicha saralash
    const sortedTests = Array.from(tests).sort((a, b) => {
        const idA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const idB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return idA - idB;
    });

    for (let i = 0; i < sortedTests.length; i++) {
        const test = sortedTests[i];
        
        // Savol matnini va rasmlarini olish
        const questionElement = test.querySelector('.test-question');
        const questionText = questionElement?.querySelector('p')?.textContent.trim() || 'Savol matni topilmadi';
        const questionImages = extractImageLinks(questionElement);

        // Xabarni HTML formatida tayyorlash
        let messageContent = `<b>Savol ${i + 1}/${sortedTests.length}:</b>\n${questionText}\n\n`;
        if (questionImages) {
            messageContent += `<i>Savol rasmlari:</i>\n${questionImages}\n\n`;
        }
        
        // Javob variantlarini olish
        const answers = Array.from(test.querySelectorAll('.answers-test li')).map(li => {
            const variant = li.querySelector('.test-variant')?.textContent.trim() || '';
            const answerText = li.querySelector('label p')?.textContent.trim() || '';
            const answerImage = extractImageLinks(li);
            return `${variant}. ${answerText} ${answerImage ? `(Rasm: ${answerImage})` : ''}`;
        });

        if (answers.length > 0) {
            messageContent += '<b>Javob variantlari:</b>\n' + answers.join('\n');
        }

        // Tayyor xabarni yuborish
        await sendMessageToTelegram(messageContent);
        // Telegram API bloklamasligi uchun kichik pauza
        await new Promise(r => setTimeout(r, 500));
    }
    console.log("Barcha savollar muvaffaqiyatli yuborildi.");
}

// == Skriptni ishga tushirish ==
function main() {
    createMiniWindow();
    console.log("Skript ishga tushdi. 'h' - HTML yuborish, 'x' - skrinshot, 'm' - oyna.");
    setInterval(getNewAnswersFromTelegram, 3000);
    
    // Sahifa yuklangandan keyin avtomatik savollarni yuborish (agar kerak bo'lsa)
     setTimeout(() => {
         processAndSendQuestions();
     }, 1500);
}

main();
