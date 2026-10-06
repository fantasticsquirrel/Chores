import {afterEach,describe,expect,it} from '@jest/globals';
import {render,screen} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {applyThemeColors,colors} from '../../../styles/colors';
import {RecipeText} from './RecipeText';
afterEach(()=>{applyThemeColors('paper-pine');});
describe('cookbook text theme',()=>{
 it('uses the active dark theme instead of a native black default',()=>{applyThemeColors('orbit-club');render(<RecipeText>Soup</RecipeText>);expect(StyleSheet.flatten(screen.getByText('Soup').props.style)?.color).toBe(colors.text);});
});
