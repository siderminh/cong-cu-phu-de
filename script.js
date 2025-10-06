// --- LOGIC CHUNG & ĐIỀU HƯỚNG TAB ---
const translatorTab = document.getElementById('translator-tab');
const converterTab = document.getElementById('converter-tab');
const translatorPanel = document.getElementById('translator');
const converterPanel = document.getElementById('converter');

const activeTabClasses = ['border-blue-600', 'text-blue-600'];
const inactiveTabClasses = ['border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'text-gray-500'];

function switchTab(activeTab, inactiveTab, activePanel, inactivePanel) {
    activePanel.classList.remove('hidden');
    inactivePanel.classList.add('hidden');
    activeTab.setAttribute('aria-selected', 'true');
    activeTab.classList.add(...activeTabClasses);
    activeTab.classList.remove(...inactiveTabClasses);
    inactiveTab.setAttribute('aria-selected', 'false');
    inactiveTab.classList.remove(...activeTabClasses);
    inactiveTab.classList.add(...inactiveTabClasses);
}

translatorTab.addEventListener('click', () => switchTab(translatorTab, converterTab, translatorPanel, converterPanel));
converterTab.addEventListener('click', () => switchTab(converterTab, translatorTab, converterPanel, translatorPanel));

// Khởi tạo tab đầu tiên là active
translatorTab.classList.add(...activeTabClasses);
translatorTab.classList.remove(...inactiveTabClasses);
converterTab.classList.add(...inactiveTabClasses);
converterTab.classList.remove(...activeTabClasses);

// --- LOGIC CỦA TRÌNH DỊCH PHỤ ĐỀ ---
{
    const fileInput = document.getElementById('subtitle-file');
    const apiKeysTextarea = document.getElementById('api-keys');
    const saveApiKeysCheckbox = document.getElementById('save-api-keys');
    const translateBtn = document.getElementById('translate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const downloadPartialBtn = document.getElementById('download-partial-btn');
    const fileNameDisplay = document.getElementById('file-name');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');
    const progressStatus = document.getElementById('progress-status');
    const messageBox = document.getElementById('message-box');
    const btnText = document.getElementById('btn-text');
    const timestampLengthInput = document.getElementById('timestamp-length');
    const startLineInput = document.getElementById('start-line');
    const autoResumeToggle = document.getElementById('auto-resume-toggle');
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    const stopBtn = document.getElementById('stop-btn');
    const pauseResumeText = document.getElementById('pause-resume-text');
    const pauseIcon = document.getElementById('pause-icon');
    const resumeIcon = document.getElementById('resume-icon');
    const fixSrErrorsToggle = document.getElementById('fix-sr-errors-toggle');
    // Lấy element cho các lựa chọn mới
    const translationStyleSelect = document.getElementById('translation-style');
    const translationDomainSelect = document.getElementById('translation-domain');


    let selectedFile = null;
    let translationState = {
        linesToTranslate: [], finalLines: [], apiKeys: [], currentApiKeyIndex: 0, currentIndex: 0,
        totalLines: 0, isPaused: false, isStopped: false, isAwaitingKey: false, 
        isAwaitingContinuation: false, translatedContent: null,
    };

    function saveKeysToLocalStorage() {
        if (saveApiKeysCheckbox.checked) {
            localStorage.setItem('geminiApiKeys', apiKeysTextarea.value.trim());
        } else {
            localStorage.removeItem('geminiApiKeys');
        }
    }

    function loadKeysFromLocalStorage() {
        const savedKeys = localStorage.getItem('geminiApiKeys');
        if (savedKeys) {
            apiKeysTextarea.value = savedKeys;
            saveApiKeysCheckbox.checked = true;
            checkInputs();
        }
    }

    function checkInputs() {
        const keys = apiKeysTextarea.value.trim().split('\n').filter(k => k.trim() !== '');
        translateBtn.disabled = !(selectedFile && keys.length > 0);
    }

    fileInput.addEventListener('change', (event) => {
        selectedFile = event.target.files[0];
        if (selectedFile) {
            fileNameDisplay.textContent = `File đã chọn: ${selectedFile.name}`;
            resetTranslationState();
            messageBox.classList.add('hidden');
            progressContainer.classList.add('hidden');
            setLoadingState(false);
        } else {
            fileNameDisplay.textContent = '';
        }
        checkInputs();
    });
    
    apiKeysTextarea.addEventListener('input', () => {
        if (saveApiKeysCheckbox.checked) saveKeysToLocalStorage();
        checkInputs();
    });
    saveApiKeysCheckbox.addEventListener('change', saveKeysToLocalStorage);

    function showMessage(message, isError = false, isWarning = false) {
        messageBox.textContent = message;
        messageBox.className = 'text-center text-sm p-3 rounded-lg'; // Reset classes
        if (isError) {
            messageBox.classList.add('bg-red-100', 'text-red-700');
        } else if (isWarning) {
            messageBox.classList.add('bg-yellow-100', 'text-yellow-700');
        } else {
            messageBox.classList.add('bg-green-100', 'text-green-700');
        }
    }

    function setLoadingState(isLoading, isAwaitingKey = false, isAwaitingContinuation = false) {
        fileInput.disabled = isLoading || isAwaitingKey || isAwaitingContinuation;
        downloadPartialBtn.classList.add('hidden');

        if (isLoading) {
            translateBtn.classList.add('hidden');
            pauseResumeBtn.classList.remove('hidden');
            stopBtn.classList.remove('hidden');
            progressContainer.classList.remove('hidden');
        } else if (isAwaitingKey || isAwaitingContinuation) {
            translateBtn.classList.remove('hidden');
            translateBtn.disabled = false;
            btnText.textContent = 'Tiếp tục dịch';
            pauseResumeBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            downloadPartialBtn.classList.remove('hidden');
        } else {
            translateBtn.classList.remove('hidden');
            btnText.textContent = 'Bắt đầu dịch';
            pauseResumeBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            checkInputs();
        }
    }

    function updateProgress(current, total) {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        progressBar.style.width = `${percentage}%`;
        progressInfo.textContent = `${current}/${total} dòng (${percentage}%)`;
    }

    function resetTranslationState() {
        translationState = {
            linesToTranslate: [], finalLines: [], apiKeys: [], currentApiKeyIndex: 0, currentIndex: 0,
            totalLines: 0, isPaused: false, isStopped: false, isAwaitingKey: false,
            isAwaitingContinuation: false, translatedContent: null,
        };
        updateProgress(0, 0);
        btnText.textContent = 'Bắt đầu dịch';
        downloadBtn.classList.add('hidden');
        downloadPartialBtn.classList.add('hidden');
    }
    
     function createSystemPrompt() {
        const shouldFixErrors = fixSrErrorsToggle.checked;
        const style = translationStyleSelect.value;
        const domain = translationDomainSelect.value;

        let promptParts = [];

        if (shouldFixErrors) {
            promptParts.push("You are a professional subtitle translator. The following text may contain speech recognition errors. First, correct the text to make it sensible in context. Then, translate the corrected text into Vietnamese.");
        } else {
            promptParts.push("You are a professional subtitle translator. Translate the following text into Vietnamese.");
        }

        promptParts.push("Do not change the original meaning.");

        if (style !== 'default') {
            promptParts.push(`The translation style should be ${style}.`);
        }

        if (domain !== 'general') {
            promptParts.push(`This text is in the ${domain} domain, so please use appropriate terminology.`);
        }

        promptParts.push("Provide ONLY the final Vietnamese translation, without any additional comments, introductions, formatting, or the corrected source text. Keep the translation on a single line.");

        return promptParts.join(' ');
    }

    async function callGeminiAPI(text, apiKey, systemPrompt) {
        const model = 'gemini-2.5-flash-preview-05-20';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: text }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'Unknown error';
            if (response.status === 429) {
                throw new Error(`API_QUOTA_EXCEEDED: ${errorMessage}`);
            }
            throw new Error(`API Error: ${response.status} - ${errorMessage}`);
        }
        const result = await response.json();
        const translatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (translatedText) return translatedText.trim();
        throw new Error('Không nhận được nội dung dịch từ API.');
    }

    async function processTranslation() {
        progressStatus.textContent = 'Đang dịch...';
        const { linesToTranslate, finalLines, totalLines } = translationState;

        while (translationState.currentIndex < linesToTranslate.length) {
            if (translationState.isPaused || translationState.isStopped) return;

            translationState.apiKeys = apiKeysTextarea.value.trim().split('\n').filter(k => k.trim() !== '');
            if (translationState.apiKeys.length === 0) {
                showMessage('Vui lòng cung cấp ít nhất một API key.', true);
                setLoadingState(false);
                return;
            }
            
            if (translationState.currentApiKeyIndex >= translationState.apiKeys.length) {
                if (autoResumeToggle.checked) {
                    showMessage('Đã thử hết các key, tự động quay lại key đầu tiên sau 3 giây...', false, true);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    translationState.currentApiKeyIndex = 0;
                } else {
                    showMessage('Tất cả các key API đã hết hạn. Vui lòng cung cấp key mới và nhấn "Tiếp tục dịch".', false, true);
                    translationState.isAwaitingKey = true;
                    setLoadingState(false, true);
                    return;
                }
            }

            const currentApiKey = translationState.apiKeys[translationState.currentApiKeyIndex];
            const i = translationState.currentIndex;
            const item = linesToTranslate[i];
            
            try {
                const timestamp = item.originalLine.substring(0, item.timestampLength);
                const textToTranslate = item.originalLine.substring(item.timestampLength);
                
                // Tạo system prompt động dựa trên lựa chọn của người dùng
                const systemPromptToUse = createSystemPrompt();

                const translatedText = await callGeminiAPI(textToTranslate, currentApiKey, systemPromptToUse);
                finalLines[item.index] = timestamp + translatedText;
                translationState.currentIndex++;
                updateProgress(translationState.currentIndex, totalLines);
            } catch (error) {
                console.error(`Lỗi dịch dòng ${item.index + 1} với key #${translationState.currentApiKeyIndex + 1}:`, error);
                if (error.message.startsWith('API_QUOTA_EXCEEDED')) {
                    showMessage(`Key #${translationState.currentApiKeyIndex + 1} đã hết hạn, tự động chuyển sang key tiếp theo...`, false, true);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    translationState.currentApiKeyIndex++;
                } else {
                    item.retryCount = (item.retryCount || 0) + 1;
                    if (autoResumeToggle.checked && item.retryCount <= 3) {
                        showMessage(`Dịch thất bại ở dòng ${item.index + 1}. Lỗi: ${error.message}. Tự động thử lại lần ${item.retryCount}/3 sau 3 giây...`, true);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } else {
                        let msg = `Dịch thất bại ở dòng ${item.index + 1}. Lỗi: ${error.message}. Nhấn "Tiếp tục dịch" để thử lại.`;
                        if(item.retryCount > 3) msg = `Dịch thất bại ở dòng ${item.index + 1} sau 3 lần thử. ${msg}`;
                        showMessage(msg, true);
                        translationState.isAwaitingContinuation = true;
                        setLoadingState(false, false, true);
                        return;
                    }
                }
            }
        }

        if (!translationState.isStopped) {
            progressStatus.textContent = 'Hoàn thành!';
            showMessage('Dịch thành công! Nhấn nút bên dưới để tải file.', false);
            translationState.translatedContent = finalLines.join('\n');
            downloadBtn.classList.remove('hidden');
            setLoadingState(false);
        }
    }

    translateBtn.addEventListener('click', async () => {
        saveKeysToLocalStorage();
        
        if (translationState.isAwaitingContinuation) {
            const currentItem = translationState.linesToTranslate[translationState.currentIndex];
            if (currentItem) currentItem.retryCount = 0;
            translationState.isAwaitingContinuation = false;
            setLoadingState(true);
            showMessage('Đang thử lại quá trình dịch...', false);
            await new Promise(resolve => setTimeout(resolve, 1000));
            processTranslation();
            return;
        }

        const keys = apiKeysTextarea.value.trim().split('\n').filter(k => k.trim() !== '');
        if (translationState.isAwaitingKey) {
            if (keys.length === 0) {
                showMessage('Vui lòng cung cấp key API mới để tiếp tục.', true);
                return;
            }
            translationState.apiKeys = keys;
            translationState.currentApiKeyIndex = 0;
            translationState.isAwaitingKey = false;
            setLoadingState(true);
            showMessage('Tiếp tục quá trình dịch với key mới...', false);
            processTranslation();
            return;
        }

        if (!selectedFile || keys.length === 0) {
            showMessage('Vui lòng chọn file và nhập ít nhất một API Key.', true);
            return;
        }

        resetTranslationState();
        translationState.apiKeys = keys;
        setLoadingState(true);
        progressStatus.textContent = 'Đang đọc file...';
        updateProgress(0, 0);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const lines = e.target.result.split(/\r?\n/);
            let timestampLength = parseInt(timestampLengthInput.value, 10) || 32;
            let startLine = parseInt(startLineInput.value, 10) || 1;

            translationState.finalLines = [...lines];
            translationState.linesToTranslate = lines.map((line, index) => ({
                originalLine: line, index: index, timestampLength: timestampLength,
                needsTranslation: (index + 1 >= startLine) && line.length > timestampLength && line.substring(timestampLength).trim() !== '',
                retryCount: 0
            })).filter(item => item.needsTranslation);
            translationState.totalLines = translationState.linesToTranslate.length;

            if (translationState.totalLines === 0) {
                showMessage('Không tìm thấy dòng nào cần dịch trong file.', false, true);
                setLoadingState(false);
                translationState.translatedContent = e.target.result;
                downloadBtn.classList.remove('hidden');
                return;
            }
            updateProgress(0, translationState.totalLines);
            processTranslation();
        };
        reader.onerror = () => {
            showMessage('Không thể đọc file đã chọn.', true);
            setLoadingState(false);
        };
        reader.readAsText(selectedFile);
    });

    pauseResumeBtn.addEventListener('click', () => {
        translationState.isPaused = !translationState.isPaused;
        if (translationState.isPaused) {
            pauseResumeText.textContent = 'Tiếp tục';
            pauseIcon.classList.add('hidden');
            resumeIcon.classList.remove('hidden');
            progressStatus.textContent = 'Đã tạm dừng';
        } else {
            pauseResumeText.textContent = 'Tạm dừng';
            pauseIcon.classList.remove('hidden');
            resumeIcon.classList.add('hidden');
            progressStatus.textContent = 'Đang dịch...';
            processTranslation();
        }
    });

    stopBtn.addEventListener('click', () => {
        translationState.isStopped = true;
        setLoadingState(false);
        progressStatus.textContent = 'Đã dừng';
        showMessage('Quá trình dịch đã được dừng.', false, true);
        downloadPartialBtn.classList.remove('hidden');
    });
    
    function downloadFile(content, fileName) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    downloadBtn.addEventListener('click', () => {
        if (translationState.translatedContent && selectedFile) {
            const originalName = selectedFile.name;
            const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
            const extension = originalName.substring(originalName.lastIndexOf('.'));
            const newFileName = `${baseName}_translated_by_gemini${extension}`;
            downloadFile(translationState.translatedContent, newFileName);
        } else {
            showMessage('Không có nội dung để tải xuống.', true);
        }
    });

    downloadPartialBtn.addEventListener('click', () => {
        if (translationState.finalLines.length > 0 && selectedFile) {
            const content = translationState.finalLines.join('\n');
            const originalName = selectedFile.name;
            const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
            const extension = originalName.substring(originalName.lastIndexOf('.'));
            const newFileName = `${baseName}_partial${extension}`;
            downloadFile(content, newFileName);
        } else {
            showMessage('Không có nội dung tạm thời để tải xuống.', true);
        }
    });

    loadKeysFromLocalStorage();
}

// --- LOGIC CỦA CÔNG CỤ CHUYỂN ĐỔI SRT ---
{
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const convertBtn = document.getElementById('convertBtn');
    const saveBtn = document.getElementById('saveBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { inputText.value = e.target.result; };
        reader.readAsText(file);
    });

    convertBtn.addEventListener('click', () => {
        const lines = inputText.value.trim().split('\n');
        let srtContent = '';
        let subtitleIndex = 1;

        lines.forEach(line => {
            const match = line.match(/\[(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\] (.*)/);
            if (match) {
                let startTime = match[1].replace('.', ',');
                let endTime = match[2].replace('.', ',');
                const text = match[3].trim();
                srtContent += `${subtitleIndex++}\n${startTime} --> ${endTime}\n${text}\n\n`;
            }
        });

        if (srtContent) {
            outputText.value = srtContent.trim();
            saveBtn.disabled = false;
            saveBtn.classList.remove('bg-gray-500', 'cursor-not-allowed', 'opacity-50');
            saveBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        } else {
            outputText.value = 'Định dạng đầu vào không hợp lệ hoặc không có nội dung.';
            saveBtn.disabled = true;
            saveBtn.classList.add('bg-gray-500', 'cursor-not-allowed', 'opacity-50');
            saveBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        }
    });

    saveBtn.addEventListener('click', () => {
        if (outputText.value && !saveBtn.disabled) {
            const blob = new Blob([outputText.value], { type: 'application/x-subrip;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'subtitles.srt';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }
    });
}
