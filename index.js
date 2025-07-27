console.log('API配置管理器扩展文件开始加载...');

import { extension_settings, renderExtensionTemplateAsync } from '../extensions.js';
import { eventSource, event_types, saveSettingsDebounced, getRequestHeaders } from '../../script.js';
import { SECRET_KEYS, writeSecret, findSecret, secret_state } from '../secrets.js';
import { oai_settings } from '../openai.js';

console.log('API配置管理器扩展导入完成');

// 扩展名称
const MODULE_NAME = 'api-config-manager';

// 默认设置
const defaultSettings = {
    configs: [] // 存储配置列表: [{name: string, url: string, key: string, model?: string}]
};

// 初始化扩展设置
function initSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = defaultSettings;
    }
    
    // 确保configs数组存在
    if (!extension_settings[MODULE_NAME].configs) {
        extension_settings[MODULE_NAME].configs = [];
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
        // 设置URL
        $('#custom_api_url_text').val(config.url).trigger('input');

        // 通过secrets系统设置密钥
        if (config.key) {
            await writeSecret(SECRET_KEYS.CUSTOM, config.key);
            // 触发input事件以更新UI状态
            $('#api_key_custom').trigger('input');
        }

        // 保存设置
        saveSettingsDebounced();

        // 显示应用成功消息
        toastr.success(`正在连接到: ${config.name}`, 'API配置管理器');

        // 如果有指定模型，先设置模型名到输入框
        if (config.model) {
            $('#custom_model_id').val(config.model).trigger('input');
            if (typeof oai_settings !== 'undefined') {
                oai_settings.custom_model = config.model;
            }
        }

        // 自动重新连接
        $('#api_button_openai').trigger('click');

        // 监听连接状态变化，连接成功后立即设置模型
        if (config.model) {
            waitForConnectionAndSetModel(config.model, config.name);
        }

    } catch (error) {
        console.error('应用配置时出错:', error);
        toastr.error(`应用配置失败: ${error.message}`, 'API配置管理器');
    }
}

// 智能等待连接并设置模型
function waitForConnectionAndSetModel(modelName, configName) {
    let attempts = 0;
    const maxAttempts = 20; // 最多尝试20次，每次500ms，总共10秒

    const checkConnection = () => {
        attempts++;

        // 检查是否已连接（通过检查模型下拉列表是否有选项）
        const modelSelect = $('#model_custom_select');
        const hasModels = modelSelect.find('option').length > 1; // 除了默认选项外还有其他选项

        if (hasModels) {
            // 连接成功，设置模型
            setPreferredModel(modelName, configName);
            return;
        }

        if (attempts < maxAttempts) {
            // 继续等待
            setTimeout(checkConnection, 500);
        } else {
            // 超时，但仍然尝试设置模型
            console.log('连接超时，但仍尝试设置模型');
            setPreferredModel(modelName, configName);
        }
    };

    // 开始检查
    setTimeout(checkConnection, 1000); // 1秒后开始检查
}

// 设置首选模型
function setPreferredModel(modelName, configName) {
    try {
        // 首先设置到custom_model_id（这是用户输入的模型名）
        $('#custom_model_id').val(modelName).trigger('input');

        // 同时更新oai_settings
        if (typeof oai_settings !== 'undefined') {
            oai_settings.custom_model = modelName;
        }

        // 检查下拉列表中是否有该模型
        const modelSelect = $('#model_custom_select');
        const modelOption = modelSelect.find(`option[value="${modelName}"]`);

        if (modelOption.length > 0) {
            // 模型在下拉列表中，选择它
            modelSelect.val(modelName).trigger('change');
            toastr.success(`已自动选择模型: ${modelName}`, 'API配置管理器');
        } else {
            // 模型不在下拉列表中，但已设置到输入框
            toastr.info(`已设置首选模型: ${modelName}（模型将在连接后可用）`, 'API配置管理器');
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
    const url = $('#api-config-url').val().trim();
    const key = $('#api-config-key').val().trim();

    if (!url || !key) {
        toastr.error('请先输入API URL和密钥', 'API配置管理器');
        return;
    }

    const button = $('#api-config-fetch-models');
    const originalText = button.text();
    button.text('获取中...').prop('disabled', true);

    try {
        // 构建模型列表请求URL
        let modelsUrl = url;
        if (!modelsUrl.endsWith('/')) {
            modelsUrl += '/';
        }
        modelsUrl += 'models';

        const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

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
    const url = $('#api-config-url').val().trim();
    const key = $('#api-config-key').val().trim();
    const model = $('#api-config-model').val().trim();

    if (!name) {
        toastr.error('请输入配置名称', 'API配置管理器');
        return;
    }

    if (!url && !key) {
        toastr.error('请至少输入URL或密钥', 'API配置管理器');
        return;
    }

    // 检查是否已存在同名配置
    const existingIndex = extension_settings[MODULE_NAME].configs.findIndex(c => c.name === name);

    const config = {
        name: name,
        url: url,
        key: key,
        model: model || undefined // 只有在有值时才保存model字段
    };

    if (existingIndex >= 0) {
        // 更新现有配置
        extension_settings[MODULE_NAME].configs[existingIndex] = config;
        toastr.success(`已更新配置: ${name}`, 'API配置管理器');
    } else {
        // 添加新配置
        extension_settings[MODULE_NAME].configs.push(config);
        toastr.success(`已保存配置: ${name}`, 'API配置管理器');
    }

    saveSettingsDebounced();
    $('#api-config-name').val('');
    $('#api-config-url').val('');
    $('#api-config-key').val('');
    $('#api-config-model').val('');
    renderConfigList();
}

// 删除了保存当前配置功能（因为密钥保护机制）

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
        const configItem = $(`
            <div class="api-config-item">
                <div class="api-config-info">
                    <div class="api-config-name">${config.name}</div>
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
    $('#api-config-url').val(config.url || '');
    $('#api-config-key').val(config.key || '');
    $('#api-config-model').val(config.model || '');

    // 隐藏模型选择下拉框
    $('#api-config-model-select').hide();

    // 设置编辑模式
    editingIndex = index;
    $('#api-config-save').text('更新配置');

    // 滚动到表单顶部
    $('#api-config-name')[0].scrollIntoView({ behavior: 'smooth' });

    // 聚焦到名称字段
    $('#api-config-name').focus();

    toastr.info(`正在编辑配置: ${config.name}`, 'API配置管理器');
}

// 创建UI
async function createUI() {
    console.log('开始创建UI...');

    try {
        const settingsHtml = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
        console.log('模板已加载:', settingsHtml);

        // 首先尝试添加到API连接界面（自定义API部分）
        const customApiForm = $('#custom_form');
        if (customApiForm.length > 0) {
            // 在自定义API表单后添加配置管理器
            customApiForm.after(settingsHtml);
            console.log('UI已添加到API连接界面（自定义API部分）');
            return;
        }

        // 如果API连接界面不可用，回退到扩展设置
        const container = $('#extensions_settings');
        console.log('容器是否存在:', container.length > 0);

        if (container.length > 0) {
            container.append(settingsHtml);
            console.log('UI已添加到容器');
        } else {
            console.error('找不到 #extensions_settings 容器');
            // 尝试其他可能的容器
            const altContainer = $('#extensions_settings2');
            if (altContainer.length > 0) {
                altContainer.append(settingsHtml);
                console.log('UI已添加到备用容器 #extensions_settings2');
            } else {
                console.error('也找不到 #extensions_settings2 容器');
                // 作为最后的手段，添加到body
                $('body').append('<div style="position: fixed; top: 10px; right: 10px; background: red; color: white; padding: 10px; z-index: 9999;">API配置管理器已加载</div>');
                console.log('已添加测试元素到body');
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

    // 获取模型列表
    $(document).on('click', '#api-config-fetch-models', fetchAvailableModels);

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
    $(document).on('keypress', '#api-config-name, #api-config-url, #api-config-key, #api-config-model', function(e) {
        if (e.which === 13) {
            saveNewConfig();
        }
    });
}

// 扩展初始化函数
async function initExtension() {
    console.log('API配置管理器扩展开始初始化...');

    initSettings();
    console.log('设置已初始化');

    await createUI();
    console.log('UI已创建');

    bindEvents();
    console.log('事件已绑定');

    renderConfigList(); // 初始化时渲染配置列表
    console.log('配置列表已渲染');

    console.log('API配置管理器扩展已加载完成');
}

// SillyTavern扩展初始化
jQuery(async () => {
    // 检查是否被禁用
    if (extension_settings.disabledExtensions.includes(MODULE_NAME)) {
        console.log('API配置管理器扩展已被禁用');
        return;
    }

    await initExtension();
});
