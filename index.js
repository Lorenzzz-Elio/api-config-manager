import { extension_settings, renderExtensionTemplateAsync } from '../../../../../scripts/extensions.js';
import { eventSource, event_types, saveSettingsDebounced, getRequestHeaders } from '../../../../../script.js';
import { SECRET_KEYS, writeSecret, findSecret, rotateSecret, readSecretState, secret_state } from '../../../../../scripts/secrets.js';
import { oai_settings } from '../../../../../scripts/openai.js';

// 扩展名称
const MODULE_NAME = 'api-config-manager';

const CHAT_COMPLETION_SOURCES = {
    CUSTOM: 'custom',
    MAKERSUITE: 'makersuite',
};

const SOURCE_LABELS = {
    [CHAT_COMPLETION_SOURCES.CUSTOM]: 'Custom (OpenAI兼容)',
    [CHAT_COMPLETION_SOURCES.MAKERSUITE]: 'Google AI Studio',
};

const SOURCE_MODEL_SELECTORS = {
    [CHAT_COMPLETION_SOURCES.CUSTOM]: '#model_custom_select',
    [CHAT_COMPLETION_SOURCES.MAKERSUITE]: '#model_google_select',
};

const SOURCE_MODEL_SETTING_KEYS = {
    [CHAT_COMPLETION_SOURCES.CUSTOM]: 'custom_model',
    [CHAT_COMPLETION_SOURCES.MAKERSUITE]: 'google_model',
};

const SOURCE_SECRET_KEYS = {
    [CHAT_COMPLETION_SOURCES.CUSTOM]: SECRET_KEYS.CUSTOM,
    [CHAT_COMPLETION_SOURCES.MAKERSUITE]: SECRET_KEYS.MAKERSUITE,
};

// 扩展信息
const EXTENSION_INFO = {
    name: 'API配置管理器',
    version: '1.3.0',
    author: 'Lorenzzz-Elio',
    repository: 'https://github.com/Lorenzzz-Elio/api-config-manager'
};

// 默认设置
const defaultSettings = {
    configs: [] // 存储配置列表: [{name: string, url: string, key: string, model?: string}]
};

// 编辑状态
let editingIndex = -1;

async function findExistingSecretIdByValue(key, value) {
    const secrets = Array.isArray(secret_state?.[key]) ? secret_state[key] : [];

    for (const secret of secrets) {
        if (!secret?.id) continue;
        if (typeof secret.value === 'string' && secret.value === value) {
            return secret.id;
        }
    }

    // If secret values are masked, trying to read every entry would be very slow.
    // Only attempt server-side reads if we can read at least one secret value.
    const probeId = secrets.find(s => s?.id)?.id;
    if (!probeId) return null;
    const probeValue = await findSecret(key, probeId);
    if (!probeValue) return null;

    for (const secret of secrets) {
        if (!secret?.id) continue;
        const realValue = await findSecret(key, secret.id);
        if (realValue && realValue === value) {
            return secret.id;
        }
    }

    return null;
}

async function ensureSecretActive(key, value, label) {
    if (!value) return null;

    if (!secret_state || Object.keys(secret_state).length === 0) {
        await readSecretState();
    }

    const existingId = await findExistingSecretIdByValue(key, value);
    if (existingId) {
        await rotateSecret(key, existingId);
        return existingId;
    }

    return await writeSecret(key, value, label);
}

function normalizeSource(source) {
    if (source === CHAT_COMPLETION_SOURCES.MAKERSUITE) return CHAT_COMPLETION_SOURCES.MAKERSUITE;
    return CHAT_COMPLETION_SOURCES.CUSTOM;
}

function getSourceLabel(source) {
    const normalized = normalizeSource(source);
    if (normalized !== source && source) {
        return `Unsupported (${source})`;
    }
    return SOURCE_LABELS[normalized] || SOURCE_LABELS[CHAT_COMPLETION_SOURCES.CUSTOM];
}

function getModelSelectSelector(source) {
    return SOURCE_MODEL_SELECTORS[normalizeSource(source)] || SOURCE_MODEL_SELECTORS[CHAT_COMPLETION_SOURCES.CUSTOM];
}

function setChatCompletionSource(source) {
    const normalized = normalizeSource(source);
    $('#chat_completion_source').val(normalized).trigger('change');
    if (typeof oai_settings !== 'undefined') {
        oai_settings.chat_completion_source = normalized;
    }
}

function setReverseProxyFields(reverseProxy, proxyPassword) {
    if (reverseProxy !== undefined) {
        $('#openai_reverse_proxy').val(reverseProxy ?? '').trigger('input');
        if (typeof oai_settings !== 'undefined') {
            oai_settings.reverse_proxy = reverseProxy ?? '';
        }
    }

    if (proxyPassword !== undefined) {
        $('#openai_proxy_password').val(proxyPassword ?? '').trigger('input');
        if (typeof oai_settings !== 'undefined') {
            oai_settings.proxy_password = proxyPassword ?? '';
        }
    }
}

async function setSourceSecretIfProvided(source, configName, value, config) {
    const normalized = normalizeSource(source);
    const secretKey = SOURCE_SECRET_KEYS[normalized];
    if (!secretKey || !value) return;

    const label = `ACM: ${configName || getSourceLabel(normalized)}`;

    if (!secret_state || Object.keys(secret_state).length === 0) {
        await readSecretState();
    }

    const knownId =
        (config?.secretIds && typeof config.secretIds === 'object' && config.secretIds[secretKey]) ||
        (normalized === CHAT_COMPLETION_SOURCES.CUSTOM ? config?.secretId : null);

    const secrets = Array.isArray(secret_state?.[secretKey]) ? secret_state[secretKey] : [];
    const hasKnownSecret = knownId ? secrets.some(s => s?.id === knownId) : false;

    if (hasKnownSecret) {
        await rotateSecret(secretKey, knownId);
        return;
    }

    const id = await ensureSecretActive(secretKey, value, label);
    if (!id) return;

    if (!config.secretIds || typeof config.secretIds !== 'object') {
        config.secretIds = {};
    }
    config.secretIds[secretKey] = id;
}

// 初始化扩展设置
function initSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = defaultSettings;
    }
    
    // 确保configs数组存在
    if (!extension_settings[MODULE_NAME].configs) {
        extension_settings[MODULE_NAME].configs = [];
    }

    // 兼容旧配置结构
    for (const config of extension_settings[MODULE_NAME].configs) {
        if (!config || typeof config !== 'object') continue;

        if (!config.source) {
            config.source = CHAT_COMPLETION_SOURCES.CUSTOM;
        }

        if (config.source === CHAT_COMPLETION_SOURCES.CUSTOM) {
            if (config.customUrl === undefined && typeof config.url === 'string') {
                config.customUrl = config.url;
            }
            if (typeof config.customUrl === 'string') {
                config.url = config.customUrl;
            }
        }

        if (config.secretId && (!config.secretIds || typeof config.secretIds !== 'object')) {
            config.secretIds = { [SECRET_KEYS.CUSTOM]: config.secretId };
        }
    }
}

// 获取当前API配置
async function getCurrentApiConfig() {
    const url = $('#custom_api_url_text').val() || '';
    // 从secrets系统获取密钥
    const key = secret_state[SECRET_KEYS.CUSTOM] ? await findSecret(SECRET_KEYS.CUSTOM) : '';
    return { url, key };
}

// 应用配置到表单
async function applyConfig(config) {
    try {
        if (!$('#api_button_openai').length || !$('#chat_completion_source').length) {
            throw new Error('未找到API连接界面元素，请在OpenAI/Chat Completions设置页使用此扩展');
        }

        const rawSource = typeof config?.source === 'string' ? config.source : CHAT_COMPLETION_SOURCES.CUSTOM;
        if (rawSource && ![CHAT_COMPLETION_SOURCES.CUSTOM, CHAT_COMPLETION_SOURCES.MAKERSUITE].includes(rawSource)) {
            toastr.error(`该配置的来源“${rawSource}”已不再受此扩展支持，请编辑配置并改为Custom/Google AI Studio`, 'API配置管理器');
            return;
        }

        const source = normalizeSource(rawSource);
        setChatCompletionSource(source);

        if (source === CHAT_COMPLETION_SOURCES.CUSTOM) {
            const customUrl = (typeof config.customUrl === 'string' ? config.customUrl : config.url) || '';
            $('#custom_api_url_text').val(customUrl).trigger('input');
            if (typeof oai_settings !== 'undefined') {
                oai_settings.custom_url = customUrl;
            }
        } else if (source === CHAT_COMPLETION_SOURCES.MAKERSUITE) {
            setReverseProxyFields(config.reverseProxy, config.proxyPassword);
        }

        // 通过secrets系统设置密钥（仅在配置里填写了key时覆盖/激活）
        await setSourceSecretIfProvided(source, config.name, config.key, config);

        // 保存设置
        saveSettingsDebounced();

        // 显示应用成功消息
        toastr.success(`正在连接到: ${config.name}（${getSourceLabel(source)}）`, 'API配置管理器');

        // 如果有指定模型，先尝试设置（连接完成后会再次尝试自动选中）
        if (config.model) {
            setPreferredModel(config.model, config.name, source);
        }

        // 自动重新连接
        $('#api_button_openai').trigger('click');

        // 监听连接状态变化，连接成功后立即设置模型
        if (config.model) {
            waitForConnectionAndSetModel(config.model, config.name, source);
        }

    } catch (error) {
        console.error('应用配置时出错:', error);
        toastr.error(`应用配置失败: ${error.message}`, 'API配置管理器');
    }
}

// 智能等待连接并设置模型
function waitForConnectionAndSetModel(modelName, configName, source) {
    let attempts = 0;
    const maxAttempts = 20; // 最多尝试20次，每次500ms，总共10秒

    const checkConnection = () => {
        attempts++;

        // 检查是否已连接（通过检查模型下拉列表是否有选项）
        const modelSelect = $(getModelSelectSelector(source));
        const hasModels = modelSelect.find('option').length > 1; // 除了默认选项外还有其他选项

        if (hasModels) {
            // 连接成功，设置模型
            setPreferredModel(modelName, configName, source);
            return;
        }

        if (attempts < maxAttempts) {
            // 继续等待
            setTimeout(checkConnection, 500);
        } else {
            // 超时，但仍然尝试设置模型
            setPreferredModel(modelName, configName, source);
        }
    };

    // 开始检查
    setTimeout(checkConnection, 1000); // 1秒后开始检查
}

// 设置首选模型
function setPreferredModel(modelName, configName, source) {
    try {
        const normalized = normalizeSource(source);

        // 更新oai_settings
        if (typeof oai_settings !== 'undefined') {
            const settingKey = SOURCE_MODEL_SETTING_KEYS[normalized];
            if (settingKey) {
                oai_settings[settingKey] = modelName;
            }
        }

        if (normalized === CHAT_COMPLETION_SOURCES.CUSTOM) {
            $('#custom_model_id').val(modelName).trigger('input');
        }

        // 检查下拉列表中是否有该模型
        const modelSelect = $(getModelSelectSelector(normalized));
        if (!modelSelect.length) {
            toastr.info(`已设置首选模型: ${modelName}（未找到模型下拉框，连接后可用）`, 'API配置管理器');
            saveSettingsDebounced();
            return;
        }

        const modelOption = modelSelect.find(`option[value="${modelName}"]`);

        if (modelOption.length > 0) {
            // 模型在下拉列表中，选择它
            modelSelect.val(modelName).trigger('change');
            toastr.success(`已自动选择模型: ${modelName}`, 'API配置管理器');
        } else {
            // 模型不在下拉列表中：允许手动输入的来源（尤其是Custom）可以临时注入选项以便生效
            if (modelSelect.is('select')) {
                modelSelect.append(`<option value="${modelName}">${modelName}</option>`);
                modelSelect.val(modelName).trigger('change');
                toastr.success(`已设置模型: ${modelName}（手动添加）`, 'API配置管理器');
            } else {
                toastr.info(`已设置首选模型: ${modelName}（模型将在连接后可用）`, 'API配置管理器');
            }
        }

        // 保存设置
        saveSettingsDebounced();

    } catch (error) {
        console.error('设置模型时出错:', error);
        toastr.warning(`无法自动设置模型 ${modelName}，请手动选择`, 'API配置管理器');
    }
}

// 获取可用模型列表
async function fetchAvailableModels() {
    const source = normalizeSource($('#api-config-source').val());

    const customUrl = $('#api-config-url').val().trim();
    const apiKey = $('#api-config-key').val().trim();
    const reverseProxy = $('#api-config-reverse-proxy').val().trim();
    const proxyPassword = $('#api-config-proxy-password').val().trim();

    if (source === CHAT_COMPLETION_SOURCES.CUSTOM && !customUrl) {
        toastr.error('请先输入Custom API URL', 'API配置管理器');
        return;
    }

    const button = $('#api-config-fetch-models');
    const originalText = button.text();
    button.text('获取中...').prop('disabled', true);

    try {
        if (source === CHAT_COMPLETION_SOURCES.CUSTOM) {
            if (apiKey) {
                await ensureSecretActive(SECRET_KEYS.CUSTOM, apiKey, 'ACM: Fetch models (Custom)');
            }
        } else if (source === CHAT_COMPLETION_SOURCES.MAKERSUITE) {
            if (!reverseProxy && apiKey) {
                await ensureSecretActive(SECRET_KEYS.MAKERSUITE, apiKey, 'ACM: Fetch models (AI Studio)');
            }
        }

        /** @type {any} */
        const requestData = {
            chat_completion_source: source,
            reverse_proxy: reverseProxy,
            proxy_password: proxyPassword,
        };

        if (source === CHAT_COMPLETION_SOURCES.CUSTOM) {
            requestData.custom_url = customUrl;
        }

        const response = await fetch('/api/backends/chat-completions/status', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(requestData),
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error('API连接失败，请检查URL和密钥是否正确');
        }

        if (data.data && Array.isArray(data.data)) {
            const modelSelect = $('#api-config-model-select');
            modelSelect.empty().append('<option value="">选择模型...</option>');

            // 按模型ID排序
            const models = data.data.sort((a, b) => a.id.localeCompare(b.id));

            models.forEach(model => {
                modelSelect.append(`<option value="${model.id}">${model.id}</option>`);
            });

            modelSelect.show();
            toastr.success(`已获取到 ${models.length} 个可用模型`, 'API配置管理器');
        } else {
            throw new Error('API返回的数据格式不正确');
        }

    } catch (error) {
        console.error('获取模型列表失败:', error);
        toastr.error(`获取模型列表失败: ${error.message}`, 'API配置管理器');
    } finally {
        button.text(originalText).prop('disabled', false);
    }
}

// 保存新配置（从用户输入）
function saveNewConfig() {
    const name = $('#api-config-name').val().trim();
    const source = normalizeSource($('#api-config-source').val());

    const customUrl = $('#api-config-url').val().trim();
    const key = $('#api-config-key').val().trim();
    const reverseProxy = $('#api-config-reverse-proxy').val().trim();
    const proxyPassword = $('#api-config-proxy-password').val().trim();
    const model = $('#api-config-model').val().trim();

    if (!name) {
        toastr.error('请输入配置名称', 'API配置管理器');
        return;
    }

    if (source === CHAT_COMPLETION_SOURCES.CUSTOM) {
        if (!customUrl && !key) {
            toastr.error('Custom配置请至少输入URL或密钥', 'API配置管理器');
            return;
        }
    } else if (source === CHAT_COMPLETION_SOURCES.MAKERSUITE) {
        if (!reverseProxy && !key) {
            toastr.info('未填写反代URL和密钥：将使用酒馆已保存的Google AI Studio密钥（如已配置）', 'API配置管理器');
        }
    }

    const config = {
        name: name,
        source: source,
        url: source === CHAT_COMPLETION_SOURCES.CUSTOM ? customUrl : undefined,
        customUrl: source === CHAT_COMPLETION_SOURCES.CUSTOM ? customUrl : undefined,
        key: key,
        reverseProxy: source === CHAT_COMPLETION_SOURCES.MAKERSUITE ? reverseProxy : undefined,
        proxyPassword: source === CHAT_COMPLETION_SOURCES.MAKERSUITE ? proxyPassword : undefined,
        model: model || undefined, // 只有在有值时才保存model字段
        secretId: undefined,
        secretIds: undefined,
    };

    if (editingIndex >= 0) {
        // 更新现有配置（编辑模式）
        const previousConfig = extension_settings[MODULE_NAME].configs[editingIndex];
        const secretKey = SOURCE_SECRET_KEYS[source];
        const prevSource = normalizeSource(previousConfig?.source);
        const prevSecretId =
            (previousConfig?.secretIds && typeof previousConfig.secretIds === 'object' && secretKey ? previousConfig.secretIds[secretKey] : null) ||
            (source === CHAT_COMPLETION_SOURCES.CUSTOM ? previousConfig?.secretId : null);

        if (prevSecretId && previousConfig?.key === config.key && prevSource === source) {
            config.secretId = previousConfig.secretId;
            config.secretIds = previousConfig.secretIds;
        }

        extension_settings[MODULE_NAME].configs[editingIndex] = config;
        toastr.success(`已更新配置: ${name}`, 'API配置管理器');
        editingIndex = -1; // 重置编辑状态
        $('#api-config-save').text('保存配置'); // 重置按钮文本
        $('#api-config-cancel').hide(); // 隐藏取消按钮
    } else {
        // 检查是否已存在同名配置
        const existingIndex = extension_settings[MODULE_NAME].configs.findIndex(c => c.name === name);

        if (existingIndex >= 0) {
            // 更新现有配置
            const previousConfig = extension_settings[MODULE_NAME].configs[existingIndex];
            const secretKey = SOURCE_SECRET_KEYS[source];
            const prevSource = normalizeSource(previousConfig?.source);
            const prevSecretId =
                (previousConfig?.secretIds && typeof previousConfig.secretIds === 'object' && secretKey ? previousConfig.secretIds[secretKey] : null) ||
                (source === CHAT_COMPLETION_SOURCES.CUSTOM ? previousConfig?.secretId : null);

            if (prevSecretId && previousConfig?.key === config.key && prevSource === source) {
                config.secretId = previousConfig.secretId;
                config.secretIds = previousConfig.secretIds;
            }

            extension_settings[MODULE_NAME].configs[existingIndex] = config;
            toastr.success(`已更新配置: ${name}`, 'API配置管理器');
        } else {
            // 添加新配置
            extension_settings[MODULE_NAME].configs.push(config);
            toastr.success(`已保存配置: ${name}`, 'API配置管理器');
        }
    }

    saveSettingsDebounced();
    $('#api-config-name').val('');
    $('#api-config-url').val('');
    $('#api-config-key').val('');
    $('#api-config-reverse-proxy').val('');
    $('#api-config-proxy-password').val('');
    $('#api-config-model').val('');
    $('#api-config-model-select').hide(); // 隐藏模型选择下拉框
    updateFormBySource($('#api-config-source').val());
    renderConfigList();
}

function updateFormBySource(sourceValue) {
    const source = normalizeSource(sourceValue);

    const $customUrl = $('#api-config-url');
    const $apiKey = $('#api-config-key');
    const $reverseProxy = $('#api-config-reverse-proxy');
    const $proxyPassword = $('#api-config-proxy-password');
    const $fetchModels = $('#api-config-fetch-models');
    const $hint = $('#api-config-source-hint');

    if (source === CHAT_COMPLETION_SOURCES.CUSTOM) {
        $customUrl.show().attr('placeholder', 'Custom API URL (例如: https://api.openai.com/v1)');
        $apiKey.show().attr('placeholder', 'Custom API密钥 (可选)');
        $reverseProxy.hide();
        $proxyPassword.hide();
        $fetchModels.prop('disabled', false);
        $hint.text('Custom：使用OpenAI兼容接口（可用于反代OpenAI兼容服务）。');
    } else if (source === CHAT_COMPLETION_SOURCES.MAKERSUITE) {
        $customUrl.hide();
        $apiKey.show().attr('placeholder', 'Google AI Studio API Key (可选；不填则使用酒馆已保存的密钥)');
        $reverseProxy.show().attr('placeholder', '反代服务器URL (可选；留空使用默认)');
        $proxyPassword.show().attr('placeholder', '反代密码/Key (可选；反代需要时填写)');
        $fetchModels.prop('disabled', false);
        $hint.text('Google AI Studio：支持直接Key或使用反代（reverse_proxy + proxy_password）。');
    }
}

// 检查更新
async function checkForUpdates() {
    try {
        const response = await fetch(`${EXTENSION_INFO.repository}/raw/main/manifest.json`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const remoteManifest = await response.json();
        const currentVersion = EXTENSION_INFO.version;
        const remoteVersion = remoteManifest.version;



        if (compareVersions(remoteVersion, currentVersion) > 0) {
            return {
                hasUpdate: true,
                currentVersion,
                remoteVersion,
                changelog: remoteManifest.changelog || '无更新日志'
            };
        }

        return { hasUpdate: false, currentVersion };
    } catch (error) {
        console.error('检查更新失败:', error);
        throw error;
    }
}

// 版本比较函数
function compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
        const v1part = v1parts[i] || 0;
        const v2part = v2parts[i] || 0;

        if (v1part > v2part) return 1;
        if (v1part < v2part) return -1;
    }

    return 0;
}

// 自动更新扩展
async function updateExtension() {
    const button = $('#api-config-update');
    const originalText = button.text();
    button.text('更新中...').prop('disabled', true);

    try {
        // 使用SillyTavern的官方扩展更新API
        const response = await fetch('/api/extensions/update', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName: 'api-config-manager',
                global: true // 第三方扩展通常是全局的
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`更新请求失败: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.isUpToDate) {
            toastr.info('扩展已是最新版本', 'API配置管理器');
        } else {
            toastr.success('扩展已成功更新！请刷新页面以应用更新', 'API配置管理器');

            // 显示更新成功对话框
            const shouldReload = confirm('扩展已成功更新！是否立即刷新页面以应用更新？');
            if (shouldReload) {
                location.reload();
            }
        }

    } catch (error) {
        console.error('更新过程中发生错误:', error);
        toastr.error(`更新失败: ${error.message}`, 'API配置管理器');
    } finally {
        button.text(originalText).prop('disabled', false);
    }
}

// 检查扩展版本状态
async function checkExtensionStatus() {
    try {
        const response = await fetch('/api/extensions/version', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName: 'api-config-manager',
                global: true
            })
        });

        if (response.ok) {
            const result = await response.json();
            return {
                hasUpdate: !result.isUpToDate,
                currentVersion: EXTENSION_INFO.version,
                remoteUrl: result.remoteUrl,
                commitHash: result.currentCommitHash
            };
        }
    } catch (error) {
        console.warn('检查扩展状态失败:', error);
    }

    // 回退到手动检查
    return await checkForUpdates();
}

// 检查并提示更新
async function checkAndPromptUpdate() {
    try {
        const updateInfo = await checkExtensionStatus();

        if (updateInfo.hasUpdate) {
            const message = `发现新版本可用\n\n是否立即更新？`;

            if (confirm(message)) {
                await updateExtension();
            } else {
                // 显示更新按钮高亮提示
                $('#api-config-update').addClass('update-available');
                toastr.info('新版本可用，点击更新按钮进行更新', 'API配置管理器');
            }
        }
    } catch (error) {
        console.warn('检查更新失败，将跳过自动更新检查');
    }
}

// 删除配置
function deleteConfig(index) {
    const config = extension_settings[MODULE_NAME].configs[index];
    if (confirm(`确定要删除配置 "${config.name}" 吗？`)) {
        extension_settings[MODULE_NAME].configs.splice(index, 1);
        saveSettingsDebounced();
        renderConfigList();
        toastr.success(`已删除配置: ${config.name}`, 'API配置管理器');
    }
}

// 渲染配置列表
function renderConfigList() {
    const container = $('#api-config-list');
    container.empty();

    const configs = extension_settings[MODULE_NAME].configs;

    if (configs.length === 0) {
        container.append('<div class="api-config-empty">暂无保存的配置</div>');
        return;
    }

    configs.forEach((config, index) => {
        const sourceLabel = getSourceLabel(config.source);
        const configItem = $(`
            <div class="api-config-item">
                <div class="api-config-info">
                    <div class="api-config-name">
                        ${config.name}
                        <span class="api-config-source-tag">${sourceLabel}</span>
                    </div>
                    ${config.model ? `<div class="api-config-model">首选模型: ${config.model}</div>` : '<div class="api-config-no-model">未设置模型</div>'}
                </div>
                <div class="api-config-actions">
                    <button class="menu_button api-config-apply" data-index="${index}">应用</button>
                    <button class="menu_button api-config-edit" data-index="${index}">编辑</button>
                    <button class="menu_button api-config-delete" data-index="${index}">删除</button>
                </div>
            </div>
        `);
        container.append(configItem);
    });
}

// 编辑配置
function editConfig(index) {
    const config = extension_settings[MODULE_NAME].configs[index];

    // 填充表单
    $('#api-config-name').val(config.name);
    $('#api-config-source').val(normalizeSource(config.source)).trigger('change');
    $('#api-config-url').val((typeof config.customUrl === 'string' ? config.customUrl : config.url) || '');
    $('#api-config-key').val(config.key || '');
    $('#api-config-reverse-proxy').val(config.reverseProxy || '');
    $('#api-config-proxy-password').val(config.proxyPassword || '');
    $('#api-config-model').val(config.model || '');

    // 隐藏模型选择下拉框
    $('#api-config-model-select').hide();

    // 设置编辑模式
    editingIndex = index;
    $('#api-config-save').text('更新配置');
    $('#api-config-cancel').show(); // 显示取消按钮

    // 滚动到表单顶部
    $('#api-config-name')[0].scrollIntoView({ behavior: 'smooth' });

    // 聚焦到名称字段
    $('#api-config-name').focus();

    toastr.info(`正在编辑配置: ${config.name}`, 'API配置管理器');
}

// 取消编辑配置
function cancelEditConfig() {
    // 重置编辑状态
    editingIndex = -1;
    $('#api-config-save').text('保存配置');
    $('#api-config-cancel').hide(); // 隐藏取消按钮

    // 清空表单
    $('#api-config-name').val('');
    $('#api-config-url').val('');
    $('#api-config-key').val('');
    $('#api-config-reverse-proxy').val('');
    $('#api-config-proxy-password').val('');
    $('#api-config-model').val('');
    $('#api-config-model-select').hide(); // 隐藏模型选择下拉框
    updateFormBySource($('#api-config-source').val());

    toastr.info('已取消编辑，切换到新建配置模式', 'API配置管理器');
}

// 创建UI
async function createUI() {
    try {
        // 直接使用内联HTML而不是模板文件
        const settingsHtml = `
            <div class="api_config_settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <div class="api-config-header">
                            <div class="api-config-title">
                                <b>API配置管理器</b>
                                <span class="api-config-version">v${EXTENSION_INFO.version}</span>
                            </div>
                            <div class="api-config-actions">
                                <button id="api-config-update" class="menu_button api-config-update-btn" title="检查并更新扩展">
                                    <i class="fa-solid fa-download"></i>
                                </button>
                            </div>
                        </div>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="api-config-section">
                            <h4>添加新配置</h4>
                            <div class="flex-container flexFlowColumn flexGap5">
                                <input type="text" id="api-config-name" placeholder="配置名称 (例如: OpenAI GPT-4)" class="text_pole">
                                <select id="api-config-source" class="text_pole">
                                    <option value="${CHAT_COMPLETION_SOURCES.CUSTOM}">Custom (OpenAI兼容)</option>
                                    <option value="${CHAT_COMPLETION_SOURCES.MAKERSUITE}">Google AI Studio</option>
                                </select>
                                <input type="text" id="api-config-url" placeholder="Custom API URL (例如: https://api.openai.com/v1)" class="text_pole">
                                <input type="password" id="api-config-key" placeholder="API密钥 (可选)" class="text_pole">
                                <input type="text" id="api-config-reverse-proxy" placeholder="反代服务器URL (可选)" class="text_pole" style="display: none;">
                                <input type="password" id="api-config-proxy-password" placeholder="反代密码/Token (可选)" class="text_pole" style="display: none;">
                                <div class="flex-container flexGap5 model-input-container">
                                    <input type="text" id="api-config-model" placeholder="首选模型 (可选，例如: gpt-4)" class="text_pole" style="flex: 1;">
                                    <button id="api-config-fetch-models" class="menu_button" style="white-space: nowrap;">获取模型</button>
                                </div>
                                <select id="api-config-model-select" class="text_pole" style="display: none;">
                                    <option value="">选择模型...</option>
                                </select>
                                <div class="flex-container flexGap5 button-container">
                                    <button id="api-config-save" class="menu_button">保存配置</button>
                                    <button id="api-config-cancel" class="menu_button" style="display: none;">❌ 取消</button>
                                </div>
                            </div>
                            <small id="api-config-source-hint">Custom：使用OpenAI兼容接口（可用于反代OpenAI兼容服务）。</small>
                        </div>
                        <div class="api-config-section">
                            <h4>已保存的配置</h4>
                            <div id="api-config-list"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 首先尝试添加到API连接界面（自定义API部分）
        const customApiForm = $('#custom_form');
        if (customApiForm.length > 0) {
            // 在自定义API表单后添加配置管理器
            customApiForm.after(settingsHtml);
            return;
        }

        // 如果API连接界面不可用，回退到扩展设置
        const container = $('#extensions_settings');
        if (container.length > 0) {
            container.append(settingsHtml);
        } else {
            // 尝试其他可能的容器
            const altContainer = $('#extensions_settings2');
            if (altContainer.length > 0) {
                altContainer.append(settingsHtml);
            } else {
                console.error('找不到扩展设置容器，API配置管理器UI可能无法正常显示');
            }
        }
    } catch (error) {
        console.error('创建UI时出错:', error);
    }
}



// 绑定事件
function bindEvents() {
    // 保存新配置
    $(document).on('click', '#api-config-save', saveNewConfig);

    // 取消编辑配置
    $(document).on('click', '#api-config-cancel', cancelEditConfig);

    // 获取模型列表
    $(document).on('click', '#api-config-fetch-models', fetchAvailableModels);

    // 切换来源（更新表单展示）
    $(document).on('change', '#api-config-source', function () {
        updateFormBySource($(this).val());
    });

    // 更新扩展
    $(document).on('click', '#api-config-update', async function(e) {
        // 阻止事件冒泡，避免触发父元素的展开折叠
        e.stopPropagation();
        e.preventDefault();

        try {
            const updateInfo = await checkExtensionStatus();

            if (updateInfo.hasUpdate) {
                const message = `发现新版本可用\n\n是否立即更新？`;

                if (confirm(message)) {
                    await updateExtension();
                }
            } else {
                toastr.info(`当前已是最新版本 ${updateInfo.currentVersion}`, 'API配置管理器');
            }
        } catch (error) {
            toastr.error('检查更新失败，请检查网络连接', 'API配置管理器');
        }
    });

    // 模型选择下拉框变化
    $(document).on('change', '#api-config-model-select', function() {
        const selectedModel = $(this).val();
        if (selectedModel) {
            $('#api-config-model').val(selectedModel);
        }
    });

    // 应用配置
    $(document).on('click', '.api-config-apply', async function() {
        const index = parseInt($(this).data('index'));
        const config = extension_settings[MODULE_NAME].configs[index];
        await applyConfig(config);
    });

    // 编辑配置
    $(document).on('click', '.api-config-edit', function() {
        const index = parseInt($(this).data('index'));
        editConfig(index);
    });

    // 删除配置
    $(document).on('click', '.api-config-delete', function() {
        const index = parseInt($(this).data('index'));
        deleteConfig(index);
    });

    // 回车保存配置
    $(document).on('keypress', '#api-config-name, #api-config-url, #api-config-key, #api-config-reverse-proxy, #api-config-proxy-password, #api-config-model', function(e) {
        if (e.which === 13) {
            saveNewConfig();
        }
    });
}

// 扩展初始化函数
async function initExtension() {
    initSettings();
    await createUI();
    bindEvents();
    updateFormBySource($('#api-config-source').val());
    renderConfigList(); // 初始化时渲染配置列表

    // 延迟检查更新（避免影响扩展加载速度）
    setTimeout(() => {
        checkAndPromptUpdate().catch(error => {
            console.warn('自动检查更新失败:', error);
        });
    }, 3000);
}

// SillyTavern扩展初始化
jQuery(async () => {
    // 检查是否被禁用
    if (extension_settings.disabledExtensions.includes(MODULE_NAME)) {
        return;
    }

    await initExtension();
});
