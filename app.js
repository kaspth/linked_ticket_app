(function() {
  return {
    childRegex: /child_of:(\d*)/,
    fatherRegex: /father_of:(\d*)/,
    descriptionDelimiter: '\n--- Original Description --- \n',

    events: {
      'app.activated'                   : 'onActivated',
      'ticket.status.changed'           : 'loadIfDataReady',
      'createChildTicket.done'          : 'createChildTicketDone',
      'createChildTicket.fail'          : 'createChildTicketFail',
      'fetchTicket.done'                : 'fetchTicketDone',
      'click #new-linked-ticket'        : 'displayForm',
      'click #create-linked-ticket'     : 'create',
      'click #copy_description'         : 'copyDescription'
    },

    requests: {
      createChildTicket: function(ticket){
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          data: ticket,
          type: 'POST'
        };
      },
      updateCurrentTicket: function(data){
        return {
          url: '/api/v2/tickets/'+ this.ticket().id() +'.json',
          dataType: 'json',
          data: data,
          type: 'PUT'
        };
      },
      fetchTicket: function(id){
        return {
          url: '/api/v2/tickets/' + id + '.json?include=groups,users',
          dataType: 'json',
          type: 'GET'
        };
      }
    },

    onActivated: function(data) {
      this.doneLoading = false;

      this.ticketFields("custom_field_" + this.settings.data_field).hide();

      this.loadIfDataReady();
    },

    loadIfDataReady: function(){
      if(!this.doneLoading &&
        !!_.isEmpty(this.ticket().id())){

        if (this.hasChild() || this.hasFather())
          return this.ajax('fetchTicket', this.childID() || this.fatherID());

        this.switchTo('home');
      }
    },

    fetchTicketDone: function(data){
      var assignee = _.find(data.users, function(user){
        return user.id == data.ticket.assignee_id;
      }),
        custom_field = _.find(data.ticket.custom_fields, function(field){
          return field.id == this.settings.data_field;
        }, this),
      is_child = this.childRegex.test(custom_field.value);

      if (assignee)
        assignee = assignee.name;

      this.switchTo('has_relation', { ticket: data.ticket,
                                      is_child: is_child,
                                      assignee: assignee,
                                      groups: data.groups
                                    });
    },

    displayForm: function(event){
      event.preventDefault();

      this.switchTo('form');
    },

    create: function(event){
      event.preventDefault();

      if (this.validate())
        this.ajax('createChildTicket', this.childTicketAsJson());
    },

    validate: function(){
      var fields = [ 'subject','description' ],
        isValid = true;

      _.each(fields, function(field){
        if (!this.validateField(field, isValid))
          isValid = false;
      }, this);

      return isValid;
    },

    createChildTicketDone: function(data){
      var field = {};
      var value = "father_of:" + data.ticket.id;

      this.ticket().customField("custom_field_" + this.settings.data_field,
                                value
                               );

      field[this.settings.data_field] = value;

      this.ajax('updateCurrentTicket', { "ticket": { "fields": field }});

      this.ajax('fetchTicket', data.ticket.id);
    },

    createChildTicketFail: function(data){
      services.notify(this.I18n.t('ticket_creation_failed'), 'error');
    },

    copyDescription: function(){
      var sDescription = this.$('#description').val().split(this.descriptionDelimiter);
      var ret = sDescription[0];

      if (sDescription.length === 1)
        ret += this.descriptionDelimiter + this.ticket().description();

      this.$('#description').val(ret);
    },

    // Private... I guess.
    validateField: function(field){
      var fieldSelector = '#' +field,
      valid = false;

      if (_.isEmpty(this.$(fieldSelector).val())){
        this.$(fieldSelector).parent('.control-group').addClass('error');
      } else {
        this.$(fieldSelector).parent('.control-group').removeClass('error');
        valid = true;
      }
      return valid;
    },
    childTicketAsJson: function(){
      var params = {
        "subject": this.$('#subject').val(),
        "description": this.$('#description').val(),
        "fields": {}
      };

      if (!_.isEmpty(this.settings.child_tag))
        params.tags = [ this.settings.child_tag ];

      params.fields[this.settings.data_field] = 'child_of:' + this.ticket().id();

      if (this.$('#copy_requester').is(':checked'))
        params.requester_id = this.ticket().requester().id();

      return { "ticket": params };
    },
    dataField: function(){
      return this.ticket().customField("custom_field_" + this.settings.data_field);
    },
    hasChild: function(){
      return this.fatherRegex.test(this.dataField());
    },
    hasFather: function(){
      return this.childRegex.test(this.dataField());
    },
    childID: function(){
      if (!this.hasChild())
        return;

      return this.fatherRegex.exec(this.dataField())[1];
    },
    fatherID: function(){
      if (!this.hasFather())
        return;

      return this.childRegex.exec(this.dataField())[1];
    }
  };
}());
