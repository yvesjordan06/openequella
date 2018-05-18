import * as React from 'react';
import { WithStyles, Icon, withStyles, Theme } from "@material-ui/core";
import { fade } from '@material-ui/core/styles/colorManipulator';
import { StyleRules } from '@material-ui/core/styles';

interface AppBarQueryProps {
    onSearch?: (query?: string) => void;
    onChange: (query: string) => void;
    query: string;
}

const decorate = withStyles((theme: Theme) => {
    const style: StyleRules = {
    queryWrapper: {
        position: 'relative',
        fontFamily: theme.typography.fontFamily,
        marginRight: theme.spacing.unit * 2,
        marginLeft: theme.spacing.unit * 2,
        borderRadius: 2,
        background: fade(theme.palette.common.white, 0.15),
        width: "400px"
    },
    queryIcon: {
        width: theme.spacing.unit * 9,
        height: "100%",
        position: "absolute",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    queryField: {
        font: "inherit",
        padding: theme.spacing.unit,
        paddingLeft: theme.spacing.unit * 9,
        border: 0,
        display: "block",
        verticalAlign: "middle",
        whiteSpace: "normal",
        background: "none",
        margin: 0,
        color: "inherit",
        width: "100%"
    }
}
return style;
})

class AppBarQuery extends React.Component<AppBarQueryProps & WithStyles<'queryWrapper' | 'queryIcon' | 'queryField'>>
{
    constructor(props: AppBarQueryProps & WithStyles<'queryWrapper' | 'queryIcon' | 'queryField'>){
        super(props);
    }

    render() {
        const {classes, onChange, query} = this.props;
        return <div className={classes.queryWrapper}>
            <div className={classes.queryIcon}><Icon>search</Icon></div>
            <input type="text" className={classes.queryField} value={query} onChange={e => onChange(e.target.value)}/>
        </div>
    }
}

export default decorate<AppBarQueryProps>(AppBarQuery)