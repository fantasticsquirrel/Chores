import type {TextProps} from 'react-native';
import {Text} from 'react-native';
import {colors} from '../../../styles/colors';
export function RecipeText({style,...props}:TextProps){return <Text {...props} style={[{color:colors.text},style]}/>;}
