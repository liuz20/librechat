const { removeNullishValues } = require('librechat-data-provider');
const generateArtifactsPrompt = require('~/app/clients/prompts/artifacts');
const { getCustomConfig } = require('~/server/services/Config');



const buildOptions = async (endpoint, parsedBody, endpointType) => {
  const {
    modelLabel,
    chatGptLabel,
    promptPrefix,
    maxContextTokens,
    resendFiles = true,
    imageDetail,
    iconURL,
    greeting,
    spec,
    artifacts,
    ...modelOptions
  } = parsedBody;
  
  const customConfig = await getCustomConfig();
  
  // Use customConfig to set or override promptPrefix if available
  // Find the custom endpoint by name
  // ZL TODO - check for a proper implementation.
  const customEndpoint = customConfig?.endpoints?.custom?.find((e) => e.name === endpoint);
  const finalPromptPrefix = customEndpoint?.promptPrefix || promptPrefix;
  
  const endpointOption = removeNullishValues({
    endpoint,
    endpointType,
    modelLabel,
    chatGptLabel,
    promptPrefix: finalPromptPrefix,
    resendFiles,
    imageDetail,
    iconURL,
    greeting,
    spec,
    maxContextTokens,
    modelOptions,
  });

  if (typeof artifacts === 'string') {
    endpointOption.artifactsPrompt = generateArtifactsPrompt({ endpoint, artifacts });
  }

  return endpointOption;
};

module.exports = buildOptions;
